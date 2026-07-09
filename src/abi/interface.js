/**
 * @fileoverview Interface and ABI encoding/decoding helpers.
 *
 * This is a compatibility layer modelled after ethers.js v6 `Interface`,
 * but adapted for QuantumCoin. ABI packing/unpacking is delegated to
 * `quantum-coin-js-sdk` (WASM) as required by SPEC.md.
 */

const qcsdk = require("quantum-coin-js-sdk");
const { makeError, assertArgument } = require("../errors");
const { normalizeHex, arrayify, bytesToHex, isHexString } = require("../internal/hex");
const { EventFragment, FunctionFragment, ErrorFragment, ConstructorFragment } = require("./fragments");
const { Result } = require("../utils/result");
const { id } = require("../utils/hashing");
const jsAbi = require("./js-abi-coder");

// Remove all whitespace (used to normalize a caller-supplied canonical signature
// like "transfer(address, uint256)" before comparing against the ABI).
function _stripWhitespace(s) {
  return String(s).replace(/\s+/g, "");
}

// Canonical Solidity signature for a fragment, e.g. "transfer(address,uint256)".
// Tuples/arrays are expanded via the shared js-abi-coder canonicalizer so it
// matches the selector/topic hashing used everywhere else.
function _canonicalSignature(frag) {
  const inputs = Array.isArray(frag.inputs) ? frag.inputs : [];
  return `${frag.name}(${inputs.map((i) => jsAbi.canonicalType(i)).join(",")})`;
}

// 0x + 8 hex => a 4-byte function/error selector.
function _isSelectorHex(s) {
  return typeof s === "string" && /^0x[0-9a-fA-F]{8}$/.test(s.trim());
}

// 0x + 64 hex => a 32-byte event topic (topic0).
function _isTopicHex(s) {
  return typeof s === "string" && /^0x[0-9a-fA-F]{64}$/.test(s.trim());
}

// Resolve a function fragment for decode/encode. A fragment object (e.g. the one
// returned by parseTransaction/getFunction) is used AS-IS so an overloaded name
// is never re-resolved ambiguously; a string resolves through the ABI.
function _resolveFunctionFragment(iface, fragment) {
  if (fragment instanceof FunctionFragment) return fragment;
  if (fragment && typeof fragment === "object" && fragment.name) return new FunctionFragment(fragment);
  return iface.getFunction(fragment);
}

function _requireInitialized() {
  // eslint-disable-next-line global-require
  const { isInitialized, getInitializationPromise } = require("../../config");
  if (isInitialized()) return;
  if (getInitializationPromise() != null) {
    throw makeError(
      "QuantumCoin SDK is still initializing. Await the Initialize() promise before using SDK methods.",
      "UNKNOWN_ERROR",
      { operation: "requireInitialized" },
    );
  }
  throw makeError("QuantumCoin SDK not initialized. Call Initialize() first.", "UNKNOWN_ERROR", {
    operation: "abi",
  });
}

function _sanitizeArg(value) {
  // quantum-coin-js-sdk WASM interop does not accept BigInt values directly.
  // Convert bigint to a decimal string (ethers-like behaviour).
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(_sanitizeArg);
  if (value && typeof value === "object") {
    // Avoid mutating user input; shallow clone.
    const out = {};
    for (const k of Object.keys(value)) out[k] = _sanitizeArg(value[k]);
    return out;
  }
  return value;
}

function _sanitizeArgs(values) {
  return (Array.isArray(values) ? values : []).map(_sanitizeArg);
}

function _asAbiArray(abi) {
  if (abi == null) return [];
  if (Array.isArray(abi)) return abi;
  if (typeof abi === "object" && typeof abi.formatJson === "function") return JSON.parse(abi.formatJson());
  throw makeError("invalid ABI", "INVALID_ARGUMENT", { abi });
}

function _isNumericString(v) {
  return typeof v === "string" && /^-?\d+$/.test(v.trim());
}

function _normalizeParamTypeForQcsdk(type, components) {
  if (typeof type !== "string") return type;

  // Arrays preserve their shape; normalize the element type.
  if (type.endsWith("]")) {
    const inner = type.slice(0, type.lastIndexOf("["));
    const suffix = type.slice(type.lastIndexOf("["));
    return _normalizeParamTypeForQcsdk(inner, components) + suffix;
  }

  // Tuples: normalize component types recursively.
  if (type === "tuple") return "tuple";

  // quantum-coin-js-sdk currently only reliably packs int256/uint256.
  if (type === "uint" || type.startsWith("uint")) return "uint256";
  if (type === "int" || type.startsWith("int")) return "int256";

  // Fixed-size bytes (bytes1..bytes32) are encoded as a single 32-byte word.
  // Encode them via uint256 (big-endian), with right-padding applied.
  if (type.startsWith("bytes")) {
    const m = type.match(/^bytes(\d+)$/);
    if (m) return "uint256";
  }

  return type;
}

function _normalizeAbiForQcsdk(abi) {
  const out = Array.isArray(abi) ? abi.map((f) => ({ ...(f || {}) })) : [];
  for (const f of out) {
    if (!f || typeof f !== "object") continue;
    const inputs = Array.isArray(f.inputs) ? f.inputs : [];
    const outputs = Array.isArray(f.outputs) ? f.outputs : [];
    const normalizeParams = (params) =>
      params.map((p) => {
        const np = { ...(p || {}) };
        np.type = _normalizeParamTypeForQcsdk(String(np.type || ""), np.components);
        if (Array.isArray(np.components) && np.components.length > 0) {
          np.components = normalizeParams(np.components);
        }
        return np;
      });
    f.inputs = normalizeParams(inputs);
    if (f.type === "function") f.outputs = normalizeParams(outputs);
    if (f.type === "event") f.inputs = normalizeParams(inputs);
    if (f.type === "error") f.inputs = normalizeParams(inputs);
    if (f.type === "constructor") f.inputs = normalizeParams(inputs);
  }
  return out;
}

function _fixedBytesToUint256Decimal(type, value) {
  // Allow already-normalized numeric values.
  if (typeof value === "number") return value;
  if (_isNumericString(value)) return value.trim();

  const m = String(type || "").match(/^bytes(\d+)$/);
  const n = m ? Number(m[1]) : 0;
  if (!Number.isFinite(n) || n < 1 || n > 32) return value;

  const b = arrayify(value);
  if (b.length > n) throw makeError("fixed bytes value exceeds length", "INVALID_ARGUMENT", { type, length: b.length });

  // Right-pad to N bytes, then right-pad to 32 bytes (Solidity fixed bytes encoding).
  const fixed = new Uint8Array(n);
  fixed.set(b, 0);
  const word = new Uint8Array(32);
  word.set(fixed, 0);

  const hexWord = bytesToHex(word); // 0x + 64 hex
  // Convert to decimal string for qcsdk (it can parse uint256 from decimal string).
  return BigInt(hexWord).toString();
}

function _uint256ToFixedBytesHex(type, value) {
  const m = String(type || "").match(/^bytes(\d+)$/);
  const n = m ? Number(m[1]) : 0;
  if (!Number.isFinite(n) || n < 1 || n > 32) return value;
  if (value == null) return value;

  const bi = typeof value === "bigint" ? value : BigInt(value);
  if (bi >= (1n << 256n)) throw makeError("value exceeds uint256", "INVALID_ARGUMENT", { value: bi.toString() });
  let hex = bi.toString(16);
  hex = hex.padStart(64, "0");
  // bytesN is the first N bytes (right-padded in the 32-byte word).
  return normalizeHex("0x" + hex.slice(0, n * 2));
}

function _convertInputValueForQcsdk(param, value) {
  const type = String(param && param.type ? param.type : "");

  // Apply bigint sanitization early.
  const v = _sanitizeArg(value);

  // Arrays
  if (type.endsWith("]")) {
    const innerType = type.slice(0, type.lastIndexOf("["));
    const innerParam = { ...(param || {}), type: innerType };
    if (!Array.isArray(v)) return v;
    return v.map((x) => _convertInputValueForQcsdk(innerParam, x));
  }

  // Tuples
  if (type === "tuple") {
    const comps = Array.isArray(param && param.components) ? param.components : [];
    if (Array.isArray(v)) {
      return v.map((x, idx) => _convertInputValueForQcsdk(comps[idx] || { type: "uint256" }, x));
    }
    if (v && typeof v === "object") {
      const out = {};
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        const name = c && typeof c.name === "string" && c.name ? c.name : String(i);
        out[name] = _convertInputValueForQcsdk(c, v[name] != null ? v[name] : v[String(i)]);
      }
      return out;
    }
    return v;
  }

  // Fixed bytes
  const mBytes = type.match(/^bytes(\d+)$/);
  if (mBytes) {
    return _fixedBytesToUint256Decimal(type, v);
  }

  return v;
}

function _convertOutputValueFromQcsdk(param, value) {
  const type = String(param && param.type ? param.type : "");

  if (type.endsWith("]")) {
    const innerType = type.slice(0, type.lastIndexOf("["));
    const innerParam = { ...(param || {}), type: innerType };
    if (!Array.isArray(value)) return value;
    return value.map((x) => _convertOutputValueFromQcsdk(innerParam, x));
  }

  if (type === "tuple") {
    const comps = Array.isArray(param && param.components) ? param.components : [];
    if (Array.isArray(value)) {
      return value.map((x, idx) => _convertOutputValueFromQcsdk(comps[idx] || { type: "uint256" }, x));
    }
    if (value && typeof value === "object") {
      const out = {};
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        const name = c && typeof c.name === "string" && c.name ? c.name : String(i);
        const raw = Object.prototype.hasOwnProperty.call(value, name)
          ? value[name]
          : Object.prototype.hasOwnProperty.call(value, String(i))
            ? value[String(i)]
            : undefined;
        out[name] = _convertOutputValueFromQcsdk(c, raw);
      }
      return out;
    }
    return value;
  }

  const mBytes = type.match(/^bytes(\d+)$/);
  if (mBytes) {
    return _uint256ToFixedBytesHex(type, value);
  }

  // Normalize integer outputs to bigint for consistency with core typings.
  if (type === "uint" || type.startsWith("uint") || type === "int" || type.startsWith("int")) {
    if (value == null) return value;
    if (typeof value === "bigint") return value;
    try {
      return BigInt(value);
    } catch {
      return value;
    }
  }

  return value;
}

class Interface {
  /**
   * @param {any[]|Interface} abi
   */
  constructor(abi) {
    this.abi = _asAbiArray(abi);
    this._abiJson = JSON.stringify(this.abi);
    this._qcsdkAbi = _normalizeAbiForQcsdk(this.abi);
    this._qcsdkAbiJson = JSON.stringify(this._qcsdkAbi);
  }

  /**
   * Returns JSON format of ABI.
   * @returns {string}
   */
  formatJson() {
    return this._abiJson;
  }

  /**
   * Internal: normalized ABI JSON for qcsdk.
   * @returns {string}
   */
  _qcsdkFormatJson() {
    return this._qcsdkAbiJson;
  }

  /**
   * Internal: normalize argument values for qcsdk based on original ABI params.
   * @param {Array<any>} params
   * @param {Array<any>} values
   * @returns {Array<any>}
   */
  _qcsdkNormalizeValues(params, values) {
    const ps = Array.isArray(params) ? params : [];
    const vs = Array.isArray(values) ? values : [];
    return ps.map((p, i) => _convertInputValueForQcsdk(p, vs[i]));
  }

  /**
   * Basic formatter (ethers supports multiple formats).
   * @param {string=} format
   * @returns {string}
   */
  format(format) {
    void format;
    return this._abiJson;
  }

  /**
   * Get a function fragment by bare name, canonical signature
   * (`name(type,...)`), or 4-byte selector (`0x` + 8 hex). Mirrors ethers.js v6.
   * @param {string} nameOrSignatureOrSelector
   * @returns {FunctionFragment}
   */
  getFunction(nameOrSignatureOrSelector) {
    assertArgument(typeof nameOrSignatureOrSelector === "string", "name must be a string", "nameOrSignatureOrSelector", nameOrSignatureOrSelector);
    const key = nameOrSignatureOrSelector.trim();
    const fns = this.abi.filter((f) => f && f.type === "function" && f.name);

    if (_isSelectorHex(key)) {
      const sel = normalizeHex(key).toLowerCase();
      const found = fns.find((f) => jsAbi.functionSelectorHex(f.name, f.inputs || []).toLowerCase() === sel);
      if (!found) throw makeError("no matching function for selector", "INVALID_ARGUMENT", { selector: key });
      return new FunctionFragment(found);
    }

    if (key.indexOf("(") >= 0) {
      const norm = _stripWhitespace(key);
      const found = fns.find((f) => _canonicalSignature(f) === norm);
      if (!found) throw makeError("no matching function for signature", "INVALID_ARGUMENT", { signature: key });
      return new FunctionFragment(found);
    }

    const matches = fns.filter((f) => f.name === key);
    if (matches.length === 0) throw makeError("function not found", "INVALID_ARGUMENT", { nameOrSignatureOrSelector });
    if (matches.length > 1) {
      throw makeError("ambiguous function name; specify the full signature", "INVALID_ARGUMENT", { nameOrSignatureOrSelector });
    }
    return new FunctionFragment(matches[0]);
  }

  /**
   * Get an event fragment by bare name, canonical signature, or topic0
   * (`0x` + 64 hex). Mirrors ethers.js v6.
   * @param {string} nameOrSignatureOrTopic
   * @returns {EventFragment}
   */
  getEvent(nameOrSignatureOrTopic) {
    assertArgument(typeof nameOrSignatureOrTopic === "string", "name must be a string", "nameOrSignatureOrTopic", nameOrSignatureOrTopic);
    const key = nameOrSignatureOrTopic.trim();
    const evs = this.abi.filter((f) => f && f.type === "event" && f.name);

    if (_isTopicHex(key)) {
      const topic = normalizeHex(key);
      const found = evs.find((f) => !f.anonymous && normalizeHex(id(_canonicalSignature(f))) === topic);
      if (!found) throw makeError("no matching event for topic", "INVALID_ARGUMENT", { topic: key });
      return new EventFragment(found);
    }

    if (key.indexOf("(") >= 0) {
      const norm = _stripWhitespace(key);
      const found = evs.find((f) => _canonicalSignature(f) === norm);
      if (!found) throw makeError("no matching event for signature", "INVALID_ARGUMENT", { signature: key });
      return new EventFragment(found);
    }

    const matches = evs.filter((f) => f.name === key);
    if (matches.length === 0) throw makeError("event not found", "INVALID_ARGUMENT", { nameOrSignatureOrTopic });
    return new EventFragment(matches[0]);
  }

  /**
   * Get an error fragment by bare name, canonical signature, or 4-byte selector.
   * Mirrors ethers.js v6.
   * @param {string} nameOrSignatureOrSelector
   * @returns {ErrorFragment}
   */
  getError(nameOrSignatureOrSelector) {
    assertArgument(typeof nameOrSignatureOrSelector === "string", "name must be a string", "nameOrSignatureOrSelector", nameOrSignatureOrSelector);
    const key = nameOrSignatureOrSelector.trim();
    const errs = this.abi.filter((f) => f && f.type === "error" && f.name);

    if (_isSelectorHex(key)) {
      const sel = normalizeHex(key).toLowerCase();
      const found = errs.find((f) => jsAbi.functionSelectorHex(f.name, f.inputs || []).toLowerCase() === sel);
      if (!found) throw makeError("no matching error for selector", "INVALID_ARGUMENT", { selector: key });
      return new ErrorFragment(found);
    }

    if (key.indexOf("(") >= 0) {
      const norm = _stripWhitespace(key);
      const found = errs.find((f) => _canonicalSignature(f) === norm);
      if (!found) throw makeError("no matching error for signature", "INVALID_ARGUMENT", { signature: key });
      return new ErrorFragment(found);
    }

    const matches = errs.filter((f) => f.name === key);
    if (matches.length === 0) throw makeError("error not found", "INVALID_ARGUMENT", { nameOrSignatureOrSelector });
    return new ErrorFragment(matches[0]);
  }

  /**
   * Returns the constructor fragment if present.
   * @returns {ConstructorFragment|null}
   */
  getConstructor() {
    const found = this.abi.find((f) => f && f.type === "constructor");
    return found ? new ConstructorFragment(found) : null;
  }

  /**
   * Encode function data using quantum-coin-js-sdk.
   * @param {FunctionFragment|string} functionFragment
   * @param {any[]} values
   * @returns {string}
   */
  encodeFunctionData(functionFragment, values) {
    _requireInitialized();
    const rawArgs = Array.isArray(values) ? values : [];

    // When a fragment object is supplied (e.g. from parseTransaction /
    // getFunction), encode directly from its exact inputs via the pure-JS coder.
    // This guarantees encode/decode is a faithful round-trip (including
    // overloaded functions) and matches decodeFunctionData byte-for-byte.
    if (functionFragment && typeof functionFragment === "object") {
      const fname = functionFragment.name;
      assertArgument(typeof fname === "string" && fname.length > 0, "invalid function", "functionFragment", functionFragment);
      const finputs = Array.isArray(functionFragment.inputs) ? functionFragment.inputs : [];
      return jsAbi.encodeFunctionData(fname, finputs, rawArgs);
    }

    const name = functionFragment;
    assertArgument(typeof name === "string" && name.length > 0, "invalid function", "functionFragment", functionFragment);
    const frag = this.getFunction(name);
    const inputs = Array.isArray(frag.inputs) ? frag.inputs : [];

    // Fallback for complex ABI surfaces where qcsdk packing is unreliable.
    if (jsAbi.needsJsAbi(inputs)) {
      return jsAbi.encodeFunctionData(frag.name, inputs, rawArgs);
    }

    const args = inputs.map((p, idx) => _convertInputValueForQcsdk(p, rawArgs[idx]));
    const res = qcsdk.packMethodData(this._qcsdkAbiJson, frag.name, ...args);
    if (!res || typeof res.error !== "string") throw makeError("packMethodData failed", "UNKNOWN_ERROR", {});
    if (res.error) throw makeError(res.error, "UNKNOWN_ERROR", { operation: "packMethodData", function: frag.name });
    return normalizeHex(res.result);
  }

  /**
   * Encode ABI constructor arguments for a contract deployment (no selector).
   * Returns "0x" when the constructor takes no arguments. The caller appends
   * this to the creation bytecode. Mirrors ethers.js v6.
   * @param {any[]=} values
   * @returns {string}
   */
  encodeDeploy(values) {
    _requireInitialized();
    const ctor = this.getConstructor();
    const inputs = ctor && Array.isArray(ctor.inputs) ? ctor.inputs : [];
    const rawArgs = Array.isArray(values) ? values : [];
    if (inputs.length === 0) return "0x";
    return normalizeHex(bytesToHex(jsAbi.encodeTupleLike(inputs, rawArgs)));
  }

  /**
   * Decode the calldata of a function call (4-byte selector + ABI-encoded
   * arguments), returning the decoded input arguments as a Result. The data's
   * selector must match the resolved function. Mirrors ethers.js v6.
   * @param {FunctionFragment|string} fragment
   * @param {string} data
   * @returns {Result}
   */
  decodeFunctionData(fragment, data) {
    _requireInitialized();
    assertArgument(typeof data === "string" && isHexString(data), "data must be a hex string", "data", data);
    const frag = _resolveFunctionFragment(this, fragment);
    const inputs = Array.isArray(frag.inputs) ? frag.inputs : [];
    const selector = jsAbi.functionSelectorHex(frag.name, inputs).toLowerCase();
    const norm = normalizeHex(data);
    const bytes = arrayify(norm);
    if (bytes.length < 4 || norm.slice(0, 10).toLowerCase() !== selector) {
      throw makeError("data selector does not match function", "INVALID_ARGUMENT", { function: frag.name, data });
    }
    const items = jsAbi.decodeTupleLike(inputs, bytes.slice(4), 0);
    const keys = inputs.map((i) => (i && typeof i.name === "string" && i.name.length ? i.name : null));
    return Result.fromItems(items, keys);
  }

  /**
   * Decode function result using quantum-coin-js-sdk.
   * @param {FunctionFragment|string} functionFragment
   * @param {string} data
   * @returns {any}
   */
  decodeFunctionResult(functionFragment, data) {
    _requireInitialized();
    const name = typeof functionFragment === "string" ? functionFragment : functionFragment?.name;
    assertArgument(typeof name === "string" && name.length > 0, "invalid function", "functionFragment", functionFragment);
    assertArgument(typeof data === "string", "data must be a hex string", "data", data);
    const frag = this.getFunction(name);
    const outputs = Array.isArray(frag.outputs) ? frag.outputs : [];

    // Fallback for complex output surfaces.
    if (jsAbi.needsJsAbi(outputs)) {
      return jsAbi.decodeFunctionResult(outputs, data);
    }

    const res = qcsdk.unpackMethodData(this._qcsdkAbiJson, name, data);
    if (!res || typeof res.error !== "string") throw makeError("unpackMethodData failed", "UNKNOWN_ERROR", {});
    if (res.error) throw makeError(res.error, "UNKNOWN_ERROR", { operation: "unpackMethodData", function: name });
    try {
      const decoded = JSON.parse(res.result);
      // qcsdk generally returns an array for function outputs; convert bytesN back to hex.
      if (Array.isArray(decoded)) {
        return decoded.map((v, i) => _convertOutputValueFromQcsdk(outputs[i] || { type: "uint256" }, v));
      }
      return _convertOutputValueFromQcsdk(outputs[0] || { type: "uint256" }, decoded);
    } catch {
      return res.result;
    }
  }

  /**
   * Encode an event log from values.
   * @param {EventFragment|any} eventFragment
   * @param {any[]} values
   * @returns {{ topics: string[], data: string }}
   */
  encodeEventLog(eventFragment, values) {
    _requireInitialized();
    const name = typeof eventFragment === "string" ? eventFragment : eventFragment?.name;
    assertArgument(typeof name === "string" && name.length > 0, "invalid event", "eventFragment", eventFragment);
    const frag = this.getEvent(name);
    const inputs = Array.isArray(frag.inputs) ? frag.inputs : [];
    const rawArgs = Array.isArray(values) ? values : [];
    const args = inputs.map((p, idx) => _convertInputValueForQcsdk(p, rawArgs[idx]));
    const res = qcsdk.encodeEventLog(this._qcsdkAbiJson, name, ...args);
    if (!res || typeof res.error !== "string") throw makeError("encodeEventLog failed", "UNKNOWN_ERROR", {});
    if (res.error) throw makeError(res.error, "UNKNOWN_ERROR", { operation: "encodeEventLog", event: name });
    return res.result;
  }

  /**
   * Decode an event log.
   * @param {EventFragment|any} eventFragment
   * @param {string[]} topics
   * @param {string} data
   * @returns {any}
   */
  decodeEventLog(eventFragment, topics, data) {
    _requireInitialized();
    const name = typeof eventFragment === "string" ? eventFragment : eventFragment?.name;
    assertArgument(typeof name === "string" && name.length > 0, "invalid event", "eventFragment", eventFragment);
    assertArgument(Array.isArray(topics), "topics must be an array", "topics", topics);
    assertArgument(typeof data === "string", "data must be a string", "data", data);
    const frag = this.getEvent(name);
    const inputs = Array.isArray(frag.inputs) ? frag.inputs : [];
    const res = qcsdk.decodeEventLog(this._qcsdkAbiJson, name, topics, data);
    if (!res || typeof res.error !== "string") throw makeError("decodeEventLog failed", "UNKNOWN_ERROR", {});
    if (res.error) throw makeError(res.error, "UNKNOWN_ERROR", { operation: "decodeEventLog", event: name });
    try {
      const decoded = JSON.parse(res.result);
      if (Array.isArray(decoded)) {
        return decoded.map((v, i) => _convertOutputValueFromQcsdk(inputs[i] || { type: "uint256" }, v));
      }
      return decoded;
    } catch {
      return res.result;
    }
  }

  /**
   * Parse a transaction's calldata into its function + decoded arguments.
   * Resolves the function by the 4-byte selector in `tx.data`, decodes the
   * arguments from the real bytes, and reports `value` as a bigint. Mirrors
   * ethers.js v6 (returns a TransactionDescription-shaped object).
   * @param {{ data: string, value?: any }} tx
   * @returns {{ fragment: FunctionFragment, name: string, signature: string, selector: string, args: Result, value: bigint }}
   */
  parseTransaction(tx) {
    _requireInitialized();
    assertArgument(tx && typeof tx === "object", "tx must be an object", "tx", tx);
    const data = tx.data;
    assertArgument(typeof data === "string" && isHexString(data), "tx.data must be a hex string", "tx.data", data);
    const norm = normalizeHex(data);
    if (arrayify(norm).length < 4) throw makeError("data too short for a function selector", "INVALID_ARGUMENT", { data });
    const selector = norm.slice(0, 10);
    const frag = this.getFunction(selector);
    const args = this.decodeFunctionData(frag, norm);
    let value = 0n;
    if (tx.value != null) {
      try {
        value = BigInt(tx.value);
      } catch {
        value = 0n;
      }
    }
    return {
      fragment: frag,
      name: frag.name,
      signature: _canonicalSignature(frag),
      selector: jsAbi.functionSelectorHex(frag.name, Array.isArray(frag.inputs) ? frag.inputs : []),
      args,
      value,
    };
  }
  parseLog() {
    _requireInitialized();
    const log = arguments.length > 0 ? arguments[0] : null;
    assertArgument(log && typeof log === "object", "log must be an object", "log", log);

    const topics = log.topics;
    const data = log.data;
    assertArgument(Array.isArray(topics), "log.topics must be an array", "log.topics", topics);
    assertArgument(typeof data === "string", "log.data must be a string", "log.data", data);
    assertArgument(topics.length > 0, "log.topics must contain at least 1 topic", "log.topics", topics);

    const topic0 = normalizeHex(String(topics[0]));

    // Find event by signature topic. (Anonymous events cannot be auto-detected.)
    /** @type {any|null} */
    let matched = null;
    /** @type {string|null} */
    let signature = null;

    for (const f of this.abi) {
      if (!f || f.type !== "event") continue;
      if (f.anonymous) continue;
      if (!f.name) continue;
      const inputs = Array.isArray(f.inputs) ? f.inputs : [];
      const sig = `${f.name}(${inputs.map((i) => String(i.type || "")).join(",")})`;
      const t = normalizeHex(id(sig));
      if (t === topic0) {
        matched = f;
        signature = sig;
        break;
      }
    }

    if (!matched) {
      throw makeError("no matching event for log.topics[0]", "INVALID_ARGUMENT", { topic0 });
    }

    const fragment = new EventFragment(matched);
    const decoded = this.decodeEventLog(fragment.name, topics.map((t) => normalizeHex(String(t))), normalizeHex(data));

    const inputs = Array.isArray(matched.inputs) ? matched.inputs : [];
    const keys = inputs.map((i) => (i && typeof i.name === "string" && i.name.length ? i.name : null));

    let items = [];
    if (Array.isArray(decoded)) {
      items = decoded;
    } else if (decoded && typeof decoded === "object") {
      items = inputs.map((i, idx) => {
        const n = i && typeof i.name === "string" ? i.name : null;
        if (n && Object.prototype.hasOwnProperty.call(decoded, n)) return decoded[n];
        if (Object.prototype.hasOwnProperty.call(decoded, String(idx))) return decoded[String(idx)];
        return undefined;
      });
    } else {
      items = inputs.map(() => decoded);
    }

    const args = Result.fromItems(items, keys);
    return {
      fragment,
      name: fragment.name,
      signature: signature || fragment.name,
      topic: topic0,
      args,
    };
  }
  /**
   * Parse custom-error return data into its error fragment + decoded arguments.
   * Resolves the error by the 4-byte selector in `data`. Mirrors ethers.js v6
   * (returns an ErrorDescription-shaped object).
   * @param {string} data
   * @returns {{ fragment: ErrorFragment, name: string, signature: string, selector: string, args: Result }}
   */
  parseError(data) {
    _requireInitialized();
    assertArgument(typeof data === "string" && isHexString(data), "data must be a hex string", "data", data);
    const norm = normalizeHex(data);
    const bytes = arrayify(norm);
    if (bytes.length < 4) throw makeError("data too short for an error selector", "INVALID_ARGUMENT", { data });
    const selector = norm.slice(0, 10).toLowerCase();
    const errs = this.abi.filter((f) => f && f.type === "error" && f.name);
    const found = errs.find((f) => jsAbi.functionSelectorHex(f.name, f.inputs || []).toLowerCase() === selector);
    if (!found) throw makeError("no matching error for selector", "INVALID_ARGUMENT", { selector });
    const inputs = Array.isArray(found.inputs) ? found.inputs : [];
    const items = jsAbi.decodeTupleLike(inputs, bytes.slice(4), 0);
    const keys = inputs.map((i) => (i && typeof i.name === "string" && i.name.length ? i.name : null));
    return {
      fragment: new ErrorFragment(found),
      name: found.name,
      signature: _canonicalSignature(found),
      selector: jsAbi.functionSelectorHex(found.name, inputs),
      args: Result.fromItems(items, keys),
    };
  }

  /**
   * Return the 4-byte function selector (sighash) for a function fragment or
   * name. Mirrors ethers.js v5 getSighash / v6 FunctionFragment.selector.
   * @param {FunctionFragment|string} fragmentOrName
   * @returns {string}
   */
  getSighash(fragmentOrName) {
    const frag =
      fragmentOrName && typeof fragmentOrName === "object" && fragmentOrName.name
        ? fragmentOrName
        : this.getFunction(fragmentOrName);
    return jsAbi.functionSelectorHex(frag.name, Array.isArray(frag.inputs) ? frag.inputs : []);
  }
  /**
   * Compute the topic0 (event signature hash) for an event.
   * @param {string|EventFragment|any} nameOrFragment
   * @returns {string} normalized 0x-prefixed topic hash
   */
  getEventTopic(nameOrFragment) {
    const name = typeof nameOrFragment === "string" ? nameOrFragment : nameOrFragment?.name;
    const frag = this.getEvent(name);
    const inputs = Array.isArray(frag.inputs) ? frag.inputs : [];
    const sig = `${frag.name}(${inputs.map((i) => String(i.type || "")).join(",")})`;
    return normalizeHex(id(sig));
  }
  getFallback() {
    return null;
  }
  getReceive() {
    return null;
  }
}

class AbiCoder {
  /**
   * Encode values by types into ABI data.
   * @param {(string|any)[]} types
   * @param {any[]} values
   * @returns {string}
   */
  encode(types, values) {
    _requireInitialized();
    assertArgument(Array.isArray(types), "types must be an array", "types", types);
    assertArgument(Array.isArray(values), "values must be an array", "values", values);

    const abi = [
      {
        type: "function",
        name: "__encode",
        stateMutability: "pure",
        inputs: types.map((t, i) => ({ name: `arg${i}`, type: String(t) })),
        outputs: [],
      },
    ];
    const iface = new Interface(abi);
    const full = iface.encodeFunctionData("__encode", values);
    // Strip the 4-byte selector (8 hex chars) + 0x
    return "0x" + full.slice(10);
  }

  /**
   * Decode ABI data by output types.
   * @param {(string|any)[]} types
   * @param {string} data
   * @returns {any}
   */
  decode(types, data) {
    _requireInitialized();
    assertArgument(Array.isArray(types), "types must be an array", "types", types);
    assertArgument(typeof data === "string", "data must be a string", "data", data);

    const abi = [
      {
        type: "function",
        name: "__decode",
        stateMutability: "pure",
        inputs: [],
        outputs: types.map((t, i) => ({ name: `ret${i}`, type: String(t) })),
      },
    ];
    const iface = new Interface(abi);
    return iface.decodeFunctionResult("__decode", data);
  }

  /**
   * Return a default value for types.
   * @param {(string|any)[]} types
   * @returns {any}
   */
  getDefaultValue(types) {
    // Lightweight default; ethers returns a Result. Here we return array of nulls.
    assertArgument(Array.isArray(types), "types must be an array", "types", types);
    return types.map(() => null);
  }

  /**
   * Return the shared default AbiCoder instance (ethers.js v6 shape).
   * @returns {AbiCoder}
   */
  static defaultAbiCoder() {
    if (!AbiCoder._instance) AbiCoder._instance = new AbiCoder();
    return AbiCoder._instance;
  }
}

module.exports = { Interface, AbiCoder };

