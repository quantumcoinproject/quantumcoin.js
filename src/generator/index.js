/**
 * @fileoverview Typed contract generator (SPEC.md section 15).
 *
 * Supports generating:
 * - TypeScript source (`.ts`)
 * - JavaScript source (`.js`) + TypeScript declaration files (`.d.ts`)
 *
 * It is designed to be invoked by `generate-sdk.js` (CLI) and
 * can also be imported as a library.
 */

const fs = require("node:fs");
const path = require("node:path");

function _ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function _readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function _stripArraySuffixes(s) {
  let out = String(s || "");
  while (out.endsWith("]")) {
    out = out.slice(0, out.lastIndexOf("["));
  }
  return out;
}

function _parseArray(type) {
  const t = String(type || "");
  const idx = t.lastIndexOf("[");
  if (idx < 0 || !t.endsWith("]")) return null;
  const inner = t.slice(0, idx);
  const bracket = t.slice(idx + 1, t.length - 1); // "" => dynamic
  const fixedLen = bracket.length ? Number(bracket) : null;
  return { inner, fixedLen: fixedLen != null && Number.isFinite(fixedLen) ? fixedLen : null };
}

function _tupleBaseNameFromInternalType(contractName, internalType) {
  const raw = String(internalType || "");
  if (!raw) return null;
  const cleaned = _stripArraySuffixes(raw);
  const m = cleaned.match(/struct\s+([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/);
  if (m && m[2]) return m[2];
  // Some compilers omit "struct" keyword.
  const m2 = cleaned.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/);
  if (m2 && m2[2]) return m2[2];
  // Fallback: last segment
  const parts = cleaned.split(".");
  const last = parts[parts.length - 1];
  if (last && last !== contractName) return last;
  return null;
}

function _tupleKey(param) {
  /** @param {any} p */
  function norm(p) {
    const out = {
      name: String(p && p.name ? p.name : ""),
      type: String(p && p.type ? p.type : ""),
      internalType: String(p && p.internalType ? p.internalType : ""),
      components: [],
    };
    const comps = Array.isArray(p && p.components) ? p.components : [];
    out.components = comps.map((c) => norm(c));
    return out;
  }
  return JSON.stringify(norm(param || {}));
}

function _collectTupleRegistry(contractName, abi) {
  const byKey = new Map(); // key -> baseName
  const usedNames = new Map(); // baseName -> key
  let counter = 0;

  /** @param {any} param */
  function ensureTuple(param) {
    const key = _tupleKey(param);
    if (byKey.has(key)) return byKey.get(key);

    const suggested = _safeTypeIdent(
      _tupleBaseNameFromInternalType(contractName, param && param.internalType) || `${contractName}Tuple${++counter}`,
    );
    let baseName = suggested;
    if (usedNames.has(baseName) && usedNames.get(baseName) !== key) {
      let n = 1;
      while (usedNames.has(`${suggested}_${n}`) && usedNames.get(`${suggested}_${n}`) !== key) n++;
      baseName = `${suggested}_${n}`;
    }
    byKey.set(key, baseName);
    usedNames.set(baseName, key);

    // Recurse to nested tuples.
    const comps = Array.isArray(param && param.components) ? param.components : [];
    for (const c of comps) visitParam(c);
    return baseName;
  }

  /** @param {any} param */
  function visitParam(param) {
    const type = String(param && param.type ? param.type : "");
    if (!type) return;
    const arr = _parseArray(type);
    if (arr) {
      visitParam({ ...(param || {}), type: arr.inner });
      return;
    }
    if (type === "tuple") {
      ensureTuple(param);
      return;
    }
  }

  for (const f of abi || []) {
    if (!f || typeof f !== "object") continue;
    const inputs = Array.isArray(f.inputs) ? f.inputs : [];
    const outputs = Array.isArray(f.outputs) ? f.outputs : [];
    for (const p of inputs) visitParam(p);
    for (const p of outputs) visitParam(p);
  }

  return { byKey };
}

function _solParamToTs(param, mode, tupleReg) {
  const type = String(param && param.type ? param.type : "");
  const m = mode === "output" ? "output" : "input";

  const arr = _parseArray(type);
  if (arr) {
    const innerParam = { ...(param || {}), type: arr.inner };
    const innerTs = _solParamToTs(innerParam, mode, tupleReg);
    if (arr.fixedLen != null) return `Types.SolFixedArray<${innerTs}, ${arr.fixedLen}>`;
    return `Types.SolArray<${innerTs}>`;
  }

  if (type === "tuple") {
    const key = _tupleKey(param);
    const baseName = tupleReg && tupleReg.byKey ? tupleReg.byKey.get(key) : null;
    const n = baseName || "Tuple";
    return `${n}${m === "input" ? "Input" : "Output"}`;
  }

  // Elementary types (hard typed)
  if (type === "address") return m === "input" ? "Types.AddressLike" : "Types.SolAddress";
  if (type === "bool") return "boolean";
  if (type === "string") return "string";
  if (type === "bytes") return m === "input" ? "Types.BytesLike" : "Types.HexString";

  const mBytesN = type.match(/^bytes(\d+)$/);
  if (mBytesN) {
    const n = Number(mBytesN[1]);
    if (n === 32) return m === "input" ? "Types.Bytes32Like" : "Types.Bytes32";
    if (Number.isFinite(n) && n >= 1 && n <= 32) return m === "input" ? `Types.Bytes${n}Like` : `Types.Bytes${n}`;
  }

  const mUint = type === "uint" ? ["uint", "256"] : type.match(/^uint(\d+)$/);
  if (mUint) {
    const bits = type === "uint" ? 256 : Number(mUint[1]);
    const b = Number.isFinite(bits) ? bits : 256;
    return m === "input" ? `Types.Uint${b}Like` : `Types.Uint${b}`;
  }

  const mInt = type === "int" ? ["int", "256"] : type.match(/^int(\d+)$/);
  if (mInt) {
    const bits = type === "int" ? 256 : Number(mInt[1]);
    const b = Number.isFinite(bits) ? bits : 256;
    return m === "input" ? `Types.Int${b}Like` : `Types.Int${b}`;
  }

  // Fallback (unknown type)
  return "any";
}

function _solParamToJsDoc(param, mode, tupleReg) {
  const type = String(param && param.type ? param.type : "");
  const m = mode === "output" ? "output" : "input";

  const arr = _parseArray(type);
  if (arr) {
    const innerParam = { ...(param || {}), type: arr.inner };
    const inner = _solParamToJsDoc(innerParam, mode, tupleReg);
    return `Array<${inner}>`;
  }

  if (type === "tuple") {
    const key = _tupleKey(param);
    const baseName = tupleReg && tupleReg.byKey ? tupleReg.byKey.get(key) : null;
    const n = baseName || "Tuple";
    return `${n}${m === "input" ? "Input" : "Output"}`;
  }

  if (type === "address") {
    return m === "input" ? `import("quantumcoin/types").AddressLike` : `import("quantumcoin/types").SolAddress`;
  }
  if (type === "bool") return "boolean";
  if (type === "string") return "string";
  if (type === "bytes") {
    return m === "input" ? `import("quantumcoin/types").BytesLike` : `import("quantumcoin/types").HexString`;
  }

  const mBytesN = type.match(/^bytes(\d+)$/);
  if (mBytesN) {
    const n = Number(mBytesN[1]);
    if (n === 32) {
      return m === "input" ? `import("quantumcoin/types").Bytes32Like` : `import("quantumcoin/types").Bytes32`;
    }
    if (Number.isFinite(n) && n >= 1 && n <= 32) {
      return m === "input"
        ? `import("quantumcoin/types").Bytes${n}Like`
        : `import("quantumcoin/types").Bytes${n}`;
    }
  }

  const mUint = type === "uint" ? ["uint", "256"] : type.match(/^uint(\d+)$/);
  if (mUint) {
    const bits = type === "uint" ? 256 : Number(mUint[1]);
    const b = Number.isFinite(bits) ? bits : 256;
    return m === "input"
      ? `import("quantumcoin/types").Uint${b}Like`
      : `import("quantumcoin/types").Uint${b}`;
  }

  const mInt = type === "int" ? ["int", "256"] : type.match(/^int(\d+)$/);
  if (mInt) {
    const bits = type === "int" ? 256 : Number(mInt[1]);
    const b = Number.isFinite(bits) ? bits : 256;
    return m === "input"
      ? `import("quantumcoin/types").Int${b}Like`
      : `import("quantumcoin/types").Int${b}`;
  }

  return "any";
}

function _renderTupleTypeDefs(contractName, abi, tupleReg) {
  const lines = [];
  void contractName;

  function _findTupleParamByKey(key) {
    /** @param {any} p */
    function walkParam(p) {
      if (!p || typeof p !== "object") return null;
      const t = String(p.type || "");
      if (!t) return null;
      const arr = _parseArray(t);
      if (arr) return walkParam({ ...(p || {}), type: arr.inner });
      if (t === "tuple") {
        if (_tupleKey(p) === key) return p;
        const comps = Array.isArray(p.components) ? p.components : [];
        for (const c of comps) {
          const found = walkParam(c);
          if (found) return found;
        }
      }
      return null;
    }

    for (const f of abi || []) {
      if (!f || typeof f !== "object") continue;
      const inputs = Array.isArray(f.inputs) ? f.inputs : [];
      const outputs = Array.isArray(f.outputs) ? f.outputs : [];
      for (const p of inputs) {
        const found = walkParam(p);
        if (found) return found;
      }
      for (const p of outputs) {
        const found = walkParam(p);
        if (found) return found;
      }
    }
    return null;
  }

  /** @param {any} param */
  function tupleFields(param, mode) {
    const comps = Array.isArray(param && param.components) ? param.components : [];
    const fields = [];
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      const field = _safeIdent((c && c.name) || `field${i}`);
      fields.push(`  ${field}: ${_solParamToTs(c, mode, tupleReg)};`);
    }
    return fields;
  }

  // Render each known tuple once (as Input + Output).
  for (const [key, baseName] of tupleReg.byKey.entries()) {
    const param = _findTupleParamByKey(key);
    if (!param) continue;

    lines.push(`export type ${baseName}Input = {`);
    lines.push(...tupleFields(param, "input"));
    lines.push(`};`);
    lines.push(``);
    lines.push(`export type ${baseName}Output = {`);
    lines.push(...tupleFields(param, "output"));
    lines.push(`};`);
    lines.push(``);
  }

  return lines.length ? lines.join("\n") + "\n" : "";
}

function _renderTupleJsDocTypeDefs(contractName, abi, tupleReg) {
  void contractName;
  if (!tupleReg || !tupleReg.byKey || tupleReg.byKey.size === 0) return "";

  const lines = [];

  /** @param {string} key */
  function findTupleParamByKey(key) {
    /** @param {any} p */
    function walkParam(p) {
      if (!p || typeof p !== "object") return null;
      const t = String(p.type || "");
      if (!t) return null;
      const arr = _parseArray(t);
      if (arr) return walkParam({ ...(p || {}), type: arr.inner });
      if (t === "tuple") {
        if (_tupleKey(p) === key) return p;
        const comps = Array.isArray(p.components) ? p.components : [];
        for (const c of comps) {
          const found = walkParam(c);
          if (found) return found;
        }
      }
      return null;
    }

    for (const f of abi || []) {
      if (!f || typeof f !== "object") continue;
      const inputs = Array.isArray(f.inputs) ? f.inputs : [];
      const outputs = Array.isArray(f.outputs) ? f.outputs : [];
      for (const p of inputs) {
        const found = walkParam(p);
        if (found) return found;
      }
      for (const p of outputs) {
        const found = walkParam(p);
        if (found) return found;
      }
    }
    return null;
  }

  function renderTypedef(typeName, tupleParam, mode) {
    const comps = Array.isArray(tupleParam && tupleParam.components) ? tupleParam.components : [];
    lines.push("/**");
    lines.push(` * @typedef {Object} ${typeName}`);
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      const field = _safeIdent((c && c.name) || `field${i}`);
      lines.push(` * @property {${_solParamToJsDoc(c, mode, tupleReg)}} ${field}`);
    }
    lines.push(" */");
    lines.push("");
  }

  for (const [key, baseName] of tupleReg.byKey.entries()) {
    const param = findTupleParamByKey(key);
    if (!param) continue;
    renderTypedef(`${baseName}Input`, param, "input");
    renderTypedef(`${baseName}Output`, param, "output");
  }

  return lines.join("\n");
}

function _cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function _safeIdent(name) {
  return (name || "arg").replace(/[^a-zA-Z0-9_]/g, "_");
}

// Generated code declares its own locals (data, safeOverrides, res, txReq, ...)
// and appends an extra `overrides` parameter next to the ABI-derived parameter
// names. If a Solidity parameter shares one of those names (e.g. Uniswap's
// swap(..., bytes data)), the generated declaration would redeclare/shadow it
// and the file would not even parse. Prefix with underscores until free.
function _uniqueIdent(base, takenNames) {
  let name = base;
  while (takenNames.has(name)) name = `_${name}`;
  takenNames.add(name);
  return name;
}

// NatSpec/doc text is attacker-controllable (it comes from arbitrary Solidity
// source). It is emitted into generated `/** ... */` JSDoc blocks, so a `*/` in the
// text would close the comment early and turn whatever follows into executable code
// in the generated .js/.ts files. Neutralize the comment delimiters (and strip
// CR/LF so a line cannot be split) before interpolation.
function _escapeComment(text) {
  return String(text == null ? "" : text)
    .replace(/\*\//g, "* /")
    .replace(/\/\*/g, "/ *")
    .replace(/[\r\n]+/g, " ");
}

// Reserved words / dangerous property names that must never be emitted as a raw
// identifier (class name, function name, import/require specifier, etc.).
const _RESERVED_IDENTIFIERS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
  "else", "export", "extends", "finally", "for", "function", "if", "import", "in", "instanceof",
  "new", "return", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while",
  "with", "yield", "enum", "await", "implements", "interface", "let", "package", "private",
  "protected", "public", "static", "null", "true", "false",
  "__proto__", "constructor", "prototype",
]);

/**
 * Assert that `name` is safe to interpolate verbatim into generated source code
 * (class names, function names, type names, require/import specifiers, file names).
 *
 * This is the primary defense against code-injection and path-traversal
 * via attacker-controlled ABI / artifact `name` fields: only strict JS/TS
 * identifiers are allowed, which by construction cannot contain quotes, newlines,
 * path separators, `..`, or other breakout characters.
 *
 * @param {any} name
 * @param {string=} kind  Human-readable description for error messages.
 * @returns {string} the validated name
 */
function _assertSafeIdentifier(name, kind) {
  const label = kind || "identifier";
  if (typeof name !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`Unsafe ${label} for code generation: ${JSON.stringify(name)}`);
  }
  if (_RESERVED_IDENTIFIERS.has(name)) {
    throw new Error(`${label} must not be a reserved word: ${JSON.stringify(name)}`);
  }
  return name;
}

/**
 * Coerce an arbitrary string (e.g. a struct name derived from an attacker-controlled
 * `internalType`) into a safe type identifier. Unlike `_assertSafeIdentifier` this
 * never throws; it sanitizes so auto-generated type names always remain valid.
 * @param {any} s
 * @returns {string}
 */
function _safeTypeIdent(s) {
  let v = String(s == null ? "" : s).replace(/[^A-Za-z0-9_$]/g, "_");
  if (!/^[A-Za-z_$]/.test(v)) v = "_" + v;
  return v || "_Tuple";
}

/**
 * Validate every rendered function name in an ABI. Only `function` entries are
 * emitted as method identifiers, so those are the names that must be safe.
 * @param {any[]} abi
 */
function _assertSafeAbiNames(abi) {
  for (const f of abi || []) {
    if (f && f.type === "function" && f.name != null) {
      _assertSafeIdentifier(f.name, "ABI function name");
    }
  }
}

/**
 * Assert that `filePath` resolves to a location inside `outDir` (defense-in-depth).
 * @param {string} outDir
 * @param {string} filePath
 */
function _assertWithinDir(outDir, filePath) {
  const root = path.resolve(outDir);
  const resolved = path.resolve(filePath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Refusing to write outside output directory: ${resolved}`);
  }
}

function _findConstructor(abi) {
  const ctor = abi.find((f) => f && f.type === "constructor");
  return ctor || { type: "constructor", inputs: [] };
}

/**
 * Return true if the given bytecode artifact represents an interface
 * (or otherwise non-deployable contract with no runtime code).
 *
 * `solc` writes an empty `.bin` for `interface` declarations and fully
 * abstract `contract` declarations. We treat `null`, `undefined`, empty
 * string, and the bare `"0x"` / `"0X"` prefix as interface bytecode.
 *
 * @param {string|null|undefined} bytecode
 * @returns {boolean}
 */
function _isInterfaceBytecode(bytecode) {
  if (bytecode == null) return true;
  const s = String(bytecode).trim().toLowerCase();
  return s === "" || s === "0x";
}

function _solTypeToTestValueExpr(param) {
  const type = typeof param === "string" ? param : String(param && param.type ? param.type : "");
  const internalType = typeof param === "object" && param ? String(param.internalType || "") : "";

  // Arrays (dynamic or fixed)
  if (type.endsWith("]")) {
    const inner = type.slice(0, type.lastIndexOf("["));
    const bracket = type.slice(type.lastIndexOf("[") + 1, type.length - 1);
    const isFixed = bracket.length > 0;
    const fixedLen = isFixed ? Number(bracket) : 0;
    const elemParam = { ...(param || {}), type: inner };

    const elemExpr = _solTypeToTestValueExpr(elemParam);
    if (isFixed && Number.isFinite(fixedLen) && fixedLen > 0) {
      // Fixed arrays MUST match the exact declared length.
      // Use Array(len).fill(expr) to keep source size reasonable.
      return `Array(${fixedLen}).fill(${elemExpr})`;
    }
    return `[${elemExpr}]`;
  }

  if (type === "address") return "wallet.address";
  if (type === "bool") return "true";
  if (type === "string") return JSON.stringify("hello");
  if (type === "bytes") return JSON.stringify("0x1234");

  // Fixed-size bytes
  const mBytesN = type.match(/^bytes(\d+)$/);
  if (mBytesN) {
    const n = Number(mBytesN[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 32) return JSON.stringify(`0x${"11".repeat(n)}`);
  }

  // NOTE: quantum-coin-js-sdk WASM interop does not accept BigInt values directly.
  // Use plain numbers/strings for ints/uints.
  // Enums are ABI-encoded as uints but Solidity will revert if the value is out of range.
  if (type.startsWith("uint") && /\benum\b/.test(internalType)) return "1";
  if (type.startsWith("uint")) return "123";
  if (type.startsWith("int")) return "-123";

  // Tuple / struct
  if (type === "tuple") {
    const comps = Array.isArray(param && param.components) ? param.components : [];
    if (comps.length === 0) return "{}";
    const fields = comps.map((c, idx) => {
      const name = c && typeof c.name === "string" && c.name ? c.name : `field${idx}`;
      return `${JSON.stringify(name)}: ${_solTypeToTestValueExpr(c)}`;
    });
    return `{ ${fields.join(", ")} }`;
  }

  // Fallback
  return "undefined";
}

function _isSupportedType(type) {
  if (type.endsWith("]")) return _isSupportedType(type.slice(0, type.lastIndexOf("[")));
  return (
    type === "address" ||
    type === "bool" ||
    type === "string" ||
    type === "bytes" ||
    type === "bytes32" ||
    type.startsWith("uint") ||
    type.startsWith("int")
  );
}

function _allSupportedParams(inputs) {
  return (inputs || []).every((i) => i && typeof i.type === "string" && _isSupportedType(i.type));
}

function _typesTs() {
  return (
    `// Auto-generated by sdkgen\n\n` +
    `// Re-export ALL Solidity-related types from quantumcoin.\n` +
    `export type * from "quantumcoin/types";\n`
  );
}

function _typesJs() {
  return `// Auto-generated by sdkgen\n\n` + `module.exports = {};\n`;
}

function _typesDts() {
  return (
    `// Auto-generated by sdkgen\n\n` +
    `export type * from "quantumcoin/types";\n`
  );
}

function _renderContractTs({ contractName, abi, bytecode, docs }) {
  const functions = (abi || []).filter((f) => f && f.type === "function");
  const tupleReg = _collectTupleRegistry(contractName, abi);
  const txFns = functions.filter((f) => (f.stateMutability || "") !== "view" && (f.stateMutability || "") !== "pure");

  const contractTsLines = [];
  contractTsLines.push(`// Auto-generated by sdkgen`);
  contractTsLines.push(`import { Contract, ContractTransactionResponse, ContractRunner, TransactionResponse } from "quantumcoin";`);
  contractTsLines.push(`import type * as Types from "./types";`);
  contractTsLines.push(``);
  contractTsLines.push(_renderTupleTypeDefs(contractName, abi, tupleReg).trimEnd());
  contractTsLines.push(``);
  contractTsLines.push(`/**`);
  contractTsLines.push(` * ${contractName} - A typed contract interface for ${contractName}`);
  if (docs && typeof docs.contract === "string" && docs.contract.trim()) {
    contractTsLines.push(` *`);
    for (const line of docs.contract.split(/\r?\n/g)) {
      const t = line.trim();
      if (!t) continue;
      contractTsLines.push(` * ${_escapeComment(t)}`);
    }
  }
  contractTsLines.push(` */`);
  contractTsLines.push(`export class ${contractName} extends Contract {`);
  contractTsLines.push(`  static readonly abi = ${JSON.stringify(abi, null, 2)} as const;`);
  contractTsLines.push(`  static readonly bytecode = ${JSON.stringify(bytecode)};`);
  contractTsLines.push(``);
  contractTsLines.push(`  static connect(address: string, runner?: ContractRunner): ${contractName} {`);
  contractTsLines.push(`    return new ${contractName}(address, runner);`);
  contractTsLines.push(`  }`);
  contractTsLines.push(``);
  contractTsLines.push(`  constructor(address: string, runner?: ContractRunner, _deployTx?: TransactionResponse) {`);
  contractTsLines.push(`    super(address, ${contractName}.abi as any, runner as any, ${contractName}.bytecode);`);
  contractTsLines.push(`    // @ts-expect-error internal attach`);
  contractTsLines.push(`    this._deployTx = _deployTx;`);
  if (txFns.length) {
    contractTsLines.push(``);
    contractTsLines.push(`    // Typed populateTransaction helpers (offline signing / sendRawTransaction flows)`);
    contractTsLines.push(`    this.populateTransaction = {`);
    for (const fn of txFns) {
      const name = fn.name;
      const inputs = fn.inputs || [];
      const taken = new Set(inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
      const overridesId = _uniqueIdent("overrides", taken);
      const dataId = _uniqueIdent("data", taken);
      const safeOverridesId = _uniqueIdent("safeOverrides", taken);
      const kId = _uniqueIdent("k", taken);
      const argsSig = inputs
        .map((p, i) => `${_safeIdent(p.name || `arg${i}`)}: ${_solParamToTs(p, "input", tupleReg)}`)
        .join(", ");
      const argsNames = inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)).join(", ");
      contractTsLines.push(
        `      ${name}: async (${argsSig}${argsSig ? ", " : ""}${overridesId}?: any): Promise<import("quantumcoin").TransactionRequest> => {`,
      );
      contractTsLines.push(`        const ${dataId} = this.interface.encodeFunctionData(${JSON.stringify(name)}, [${argsNames}]);`);
      // Drop attacker-controllable to/data/from; protected fields win.
      contractTsLines.push(`        const ${safeOverridesId}: any = {};`);
      contractTsLines.push(
        `        for (const ${kId} of ["value", "gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "nonce", "chainId", "remarks", "signingContext"]) { if (${overridesId} && ${overridesId}[${kId}] !== undefined) ${safeOverridesId}[${kId}] = ${overridesId}[${kId}]; }`,
      );
      contractTsLines.push(
        `        return { ...${safeOverridesId}, to: this.address, ${dataId === "data" ? "data" : `data: ${dataId}`} };`,
      );
      contractTsLines.push(`      },`);
    }
    contractTsLines.push(`    } as any;`);
  }
  contractTsLines.push(`  }`);

  for (const fn of functions) {
    const name = fn.name;
    const inputs = fn.inputs || [];
    const outputs = fn.outputs || [];
    const argsSig = inputs
      .map((p, i) => `${_safeIdent(p.name || `arg${i}`)}: ${_solParamToTs(p, "input", tupleReg)}`)
      .join(", ");
    const argsNames = inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)).join(", ");

    const mut = fn.stateMutability || "";
    const isView = mut === "view" || mut === "pure";

    let returnTs;
    if (isView) {
      if (outputs.length === 0) returnTs = "Promise<void>";
      else if (outputs.length === 1) returnTs = `Promise<${_solParamToTs(outputs[0], "output", tupleReg)}>`;
      else returnTs = `Promise<[${outputs.map((o) => _solParamToTs(o, "output", tupleReg)).join(", ")}]>`;
    } else {
      returnTs = "Promise<ContractTransactionResponse>";
    }

    contractTsLines.push(``);
    contractTsLines.push(`  /**`);
    contractTsLines.push(`   * ${name}`);
    const fnDoc = docs && docs.functions && typeof docs.functions[name] === "string" ? docs.functions[name] : "";
    if (fnDoc && fnDoc.trim()) {
      contractTsLines.push(`   *`);
      for (const line of fnDoc.split(/\r?\n/g)) {
        const t = line.trim();
        if (!t) continue;
        contractTsLines.push(`   * ${_escapeComment(t)}`);
      }
    }
    contractTsLines.push(`   */`);
    const taken = new Set(inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
    if (isView) {
      const resId = _uniqueIdent("res", taken);
      contractTsLines.push(`  async ${name}(${argsSig}): ${returnTs} {`);
      contractTsLines.push(`    const ${resId} = await this.call(${JSON.stringify(name)}, [${argsNames}]);`);
      if (outputs.length === 0) {
        contractTsLines.push(`    void ${resId};`);
        contractTsLines.push(`    return;`);
      } else if (outputs.length === 1) {
        contractTsLines.push(`    return (Array.isArray(${resId}) ? ${resId}[0] : ${resId}) as unknown as ${_solParamToTs(outputs[0], "output", tupleReg)};`);
      } else {
        contractTsLines.push(
          `    return ${resId} as unknown as [${outputs.map((o) => _solParamToTs(o, "output", tupleReg)).join(", ")}];`,
        );
      }
      contractTsLines.push(`  }`);
    } else {
      const overridesId = _uniqueIdent("overrides", taken);
      contractTsLines.push(`  async ${name}(${argsSig}${argsSig ? ", " : ""}${overridesId}?: any): ${returnTs} {`);
      contractTsLines.push(`    return this.send(${JSON.stringify(name)}, [${argsNames}], ${overridesId});`);
      contractTsLines.push(`  }`);
    }
  }

  contractTsLines.push(`}`);
  return contractTsLines.join("\n") + "\n";
}

function _renderContractJs({ contractName, abi, bytecode, docs }) {
  const functions = (abi || []).filter((f) => f && f.type === "function");
  const tupleReg = _collectTupleRegistry(contractName, abi);
  const txFns = functions.filter((f) => (f.stateMutability || "") !== "view" && (f.stateMutability || "") !== "pure");

  const lines = [];
  lines.push(`// Auto-generated by sdkgen`);
  lines.push(`const { Contract } = require("quantumcoin");`);
  lines.push("");

  const tupleDoc = _renderTupleJsDocTypeDefs(contractName, abi, tupleReg).trimEnd();
  if (tupleDoc) {
    lines.push(tupleDoc);
    lines.push("");
  }

  lines.push("/**");
  lines.push(` * ${contractName} - A typed contract interface for ${contractName}`);
  if (docs && typeof docs.contract === "string" && docs.contract.trim()) {
    lines.push(" *");
    for (const line of docs.contract.split(/\r?\n/g)) {
      const t = line.trim();
      if (!t) continue;
      lines.push(` * ${_escapeComment(t)}`);
    }
  }
  lines.push(" */");
  lines.push(`class ${contractName} extends Contract {`);
  lines.push(`  static abi = ${JSON.stringify(abi, null, 2)};`);
  lines.push(`  static bytecode = ${JSON.stringify(bytecode)};`);
  lines.push("");
  lines.push(`  static connect(address, runner) {`);
  lines.push(`    return new ${contractName}(address, runner);`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  constructor(address, runner, _deployTx) {`);
  lines.push(`    super(address, ${contractName}.abi, runner, ${contractName}.bytecode);`);
  lines.push(`    this._deployTx = _deployTx;`);
  if (txFns.length) {
    lines.push("");
    lines.push("    // Typed populateTransaction helpers (offline signing / sendRawTransaction flows)");
    lines.push("    this.populateTransaction = {");
    for (const fn of txFns) {
      const name = fn.name;
      const inputs = fn.inputs || [];
      const taken = new Set(inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
      const overridesId = _uniqueIdent("overrides", taken);
      const dataId = _uniqueIdent("data", taken);
      const safeOverridesId = _uniqueIdent("safeOverrides", taken);
      const kId = _uniqueIdent("k", taken);
      const argsNames = inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)).join(", ");
      const argsSig = inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)).join(", ");
      lines.push(`      ${name}: async (${argsSig}${argsSig ? ", " : ""}${overridesId}) => {`);
      lines.push(`        const ${dataId} = this.interface.encodeFunctionData(${JSON.stringify(name)}, [${argsNames}]);`);
      // Drop attacker-controllable to/data/from; protected fields win.
      lines.push(`        const ${safeOverridesId} = {};`);
      lines.push(
        `        for (const ${kId} of ["value", "gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "nonce", "chainId", "remarks", "signingContext"]) { if (${overridesId} && ${overridesId}[${kId}] !== undefined) ${safeOverridesId}[${kId}] = ${overridesId}[${kId}]; }`,
      );
      lines.push(
        `        return { ...${safeOverridesId}, to: this.address, ${dataId === "data" ? "data" : `data: ${dataId}`} };`,
      );
      lines.push("      },");
    }
    lines.push("    };");
  }
  lines.push(`  }`);

  for (const fn of functions) {
    const name = fn.name;
    const inputs = fn.inputs || [];
    const outputs = fn.outputs || [];
    const argsNames = inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)).join(", ");

    const mut = fn.stateMutability || "";
    const isView = mut === "view" || mut === "pure";

    lines.push("");
    lines.push("  /**");
    lines.push(`   * ${name}`);
    const fnDoc = docs && docs.functions && typeof docs.functions[name] === "string" ? docs.functions[name] : "";
    if (fnDoc && fnDoc.trim()) {
      lines.push("   *");
      for (const line of fnDoc.split(/\r?\n/g)) {
        const t = line.trim();
        if (!t) continue;
        lines.push(`   * ${_escapeComment(t)}`);
      }
    }
    for (const p of inputs) {
      const pName = _safeIdent(p.name || "arg");
      lines.push(`   * @param {${_solParamToJsDoc(p, "input", tupleReg)}} ${pName}`);
    }
    if (isView) {
      if (outputs.length === 0) {
        lines.push(`   * @returns {Promise<void>}`);
      } else if (outputs.length === 1) {
        lines.push(`   * @returns {Promise<${_solParamToJsDoc(outputs[0], "output", tupleReg)}>} `);
      } else {
        lines.push(
          `   * @returns {Promise<[${outputs.map((o) => _solParamToJsDoc(o, "output", tupleReg)).join(", ")}]>}`,
        );
      }
    } else {
      lines.push(`   * @returns {Promise<import("quantumcoin").ContractTransactionResponse>}`);
    }
    lines.push("   */");

    const taken = new Set(inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
    if (isView) {
      const resId = _uniqueIdent("res", taken);
      lines.push(`  async ${name}(${argsNames}) {`);
      lines.push(`    const ${resId} = await this.call(${JSON.stringify(name)}, [${argsNames}]);`);
      if (outputs.length === 0) {
        lines.push(`    return;`);
      } else if (outputs.length === 1) {
        lines.push(`    return Array.isArray(${resId}) ? ${resId}[0] : ${resId};`);
      } else {
        lines.push(`    return ${resId};`);
      }
      lines.push(`  }`);
    } else {
      const overridesId = _uniqueIdent("overrides", taken);
      lines.push(`  async ${name}(${argsNames}${argsNames ? ", " : ""}${overridesId}) {`);
      lines.push(`    return this.send(${JSON.stringify(name)}, [${argsNames}], ${overridesId});`);
      lines.push(`  }`);
    }
  }

  lines.push(`}`);
  lines.push("");
  lines.push(`module.exports = { ${contractName} };`);
  lines.push("");
  return lines.join("\n");
}

function _renderContractDts({ contractName, abi }) {
  const functions = (abi || []).filter((f) => f && f.type === "function");
  const tupleReg = _collectTupleRegistry(contractName, abi);
  const txFns = functions.filter((f) => (f.stateMutability || "") !== "view" && (f.stateMutability || "") !== "pure");
  const lines = [];
  lines.push(`// Auto-generated by sdkgen`);
  lines.push(`import { Contract, ContractRunner, ContractTransactionResponse, TransactionResponse } from "quantumcoin";`);
  lines.push(`import type * as Types from "./types";`);
  lines.push("");
  const tupleDefs = _renderTupleTypeDefs(contractName, abi, tupleReg).trimEnd();
  if (tupleDefs) {
    lines.push(tupleDefs);
    lines.push("");
  }
  lines.push(`export declare class ${contractName} extends Contract {`);
  lines.push(`  static readonly abi: readonly any[];`);
  lines.push(`  static readonly bytecode: string;`);
  lines.push(`  static connect(address: string, runner?: ContractRunner): ${contractName};`);
  lines.push(`  constructor(address: string, runner?: ContractRunner, _deployTx?: TransactionResponse);`);
  if (txFns.length) {
    lines.push(`  readonly populateTransaction: {`);
    for (const fn of txFns) {
      const name = fn.name;
      const inputs = fn.inputs || [];
      const taken = new Set(inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
      const overridesId = _uniqueIdent("overrides", taken);
      const argsSig = inputs
        .map((p, i) => `${_safeIdent(p.name || `arg${i}`)}: ${_solParamToTs(p, "input", tupleReg)}`)
        .join(", ");
      lines.push(
        `    ${name}(${argsSig}${argsSig ? ", " : ""}${overridesId}?: any): Promise<import("quantumcoin").TransactionRequest>;`,
      );
    }
    lines.push(`  };`);
  }

  for (const fn of functions) {
    const name = fn.name;
    const inputs = fn.inputs || [];
    const outputs = fn.outputs || [];

    const argsSig = inputs.map((p, i) => `${_safeIdent(p.name || `arg${i}`)}: ${_solParamToTs(p, "input", tupleReg)}`).join(", ");

    const mut = fn.stateMutability || "";
    const isView = mut === "view" || mut === "pure";

    let returnTs;
    if (isView) {
      if (outputs.length === 0) returnTs = "Promise<void>";
      else if (outputs.length === 1) returnTs = `Promise<${_solParamToTs(outputs[0], "output", tupleReg)}>`;
      else returnTs = `Promise<[${outputs.map((o) => _solParamToTs(o, "output", tupleReg)).join(", ")}]>`;
    } else {
      returnTs = "Promise<ContractTransactionResponse>";
    }

    if (isView) {
      lines.push(`  ${name}(${argsSig}): ${returnTs};`);
    } else {
      const taken = new Set(inputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
      const overridesId = _uniqueIdent("overrides", taken);
      lines.push(`  ${name}(${argsSig}${argsSig ? ", " : ""}${overridesId}?: any): ${returnTs};`);
    }
  }

  lines.push(`}`);
  return lines.join("\n") + "\n";
}

function _renderFactoryTs({ contractName, abi }) {
  const factoryName = `${contractName}__factory`;
  const ctor = _findConstructor(abi);
  const ctorInputs = (ctor && ctor.inputs) || [];
  const tupleReg = _collectTupleRegistry(contractName, abi);

  const factoryTsLines = [];
  factoryTsLines.push(`// Auto-generated by sdkgen`);
  factoryTsLines.push(`import { ContractFactory, ContractRunner, getCreateAddress } from "quantumcoin";`);
  factoryTsLines.push(`import { ${contractName} } from "./${contractName}";`);
  factoryTsLines.push(`import type * as Types from "./types";`);

  // Import tuple input types used by the constructor (if any)
  const ctorTupleTypes = new Set();
  const visit = (p) => {
    const t = String(p && p.type ? p.type : "");
    const arr = _parseArray(t);
    if (arr) return visit({ ...(p || {}), type: arr.inner });
    if (t === "tuple") {
      const key = _tupleKey(p);
      const base = tupleReg.byKey.get(key);
      if (base) ctorTupleTypes.add(`${base}Input`);
      const comps = Array.isArray(p && p.components) ? p.components : [];
      for (const c of comps) visit(c);
    }
  };
  for (const p of ctorInputs) visit(p);
  if (ctorTupleTypes.size) {
    factoryTsLines.push(`import type { ${Array.from(ctorTupleTypes).sort().join(", ")} } from "./${contractName}";`);
  }
  factoryTsLines.push(``);
  factoryTsLines.push(`export class ${factoryName} extends ContractFactory {`);
  factoryTsLines.push(`  constructor(runner: ContractRunner) {`);
  factoryTsLines.push(`    super(${contractName}.abi as any, ${contractName}.bytecode as any, runner as any);`);
  factoryTsLines.push(`  }`);
  factoryTsLines.push(``);

  // Typed deploy method (uses constructor args + optional overrides)
  const deployArgsSig = ctorInputs
    .map((p, i) => `${_safeIdent(p.name || `arg${i}`)}: ${_solParamToTs(p, "input", tupleReg)}`)
    .join(", ");
  const deployArgsNames = ctorInputs.map((p, i) => _safeIdent(p.name || `arg${i}`)).join(", ");
  const taken = new Set(ctorInputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
  const [overridesId, signerId, fromId, providerId, nonceId, addressId, txReqId, safeOverridesId, kId, txId] = [
    "overrides", "signer", "from", "provider", "nonce", "address", "txReq", "safeOverrides", "k", "tx",
  ].map((n) => _uniqueIdent(n, taken));
  const prop = (key, id) => (id === key ? key : `${key}: ${id}`);

  factoryTsLines.push(`  async deploy(${deployArgsSig}${deployArgsSig ? ", " : ""}${overridesId}?: any): Promise<${contractName}> {`);
  factoryTsLines.push(`    const ${signerId}: any = (this as any).signer;`);
  factoryTsLines.push(`    if (!${signerId}) { throw new Error("missing signer"); }`);
  factoryTsLines.push(`    const ${fromId}: string = ${signerId}.getAddress ? await ${signerId}.getAddress() : ${signerId}.address;`);
  factoryTsLines.push(`    const ${providerId}: any = ${signerId}.provider;`);
  factoryTsLines.push(`    if (!${providerId} || !${providerId}.getTransactionCount) { throw new Error("missing provider"); }`);
  factoryTsLines.push(`    let ${nonceId}: number;`);
  factoryTsLines.push(`    try { ${nonceId} = await ${providerId}.getTransactionCount(${fromId}, "pending"); } catch { ${nonceId} = await ${providerId}.getTransactionCount(${fromId}, "latest"); }`);
  factoryTsLines.push(`    const ${addressId} = getCreateAddress({ ${prop("from", fromId)}, ${prop("nonce", nonceId)} });`);
  factoryTsLines.push(`    const ${txReqId}: any = this.getDeployTransaction(${deployArgsNames});`);
  // Only allow-listed override fields may reach the signer; protected fields
  // (to/data from txReq, and the computed nonce) always win.
  factoryTsLines.push(`    const ${safeOverridesId}: any = {};`);
  factoryTsLines.push(
    `    for (const ${kId} of ["value", "gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "remarks", "signingContext"]) { if (${overridesId} && ${overridesId}[${kId}] !== undefined) ${safeOverridesId}[${kId}] = ${overridesId}[${kId}]; }`,
  );
  factoryTsLines.push(`    const ${txId} = await ${signerId}.sendTransaction({ ...${txReqId}, ...${safeOverridesId}, ${prop("nonce", nonceId)} });`);
  factoryTsLines.push(`    return new ${contractName}(${addressId}, ${signerId} as any, ${txId} as any);`);
  factoryTsLines.push(`  }`);
  factoryTsLines.push(``);

  factoryTsLines.push(`  static connect(address: string, runner?: ContractRunner): ${contractName} {`);
  factoryTsLines.push(`    return ${contractName}.connect(address, runner);`);
  factoryTsLines.push(`  }`);
  factoryTsLines.push(`}`);

  return factoryTsLines.join("\n") + "\n";
}

function _renderFactoryJs({ contractName, abi }) {
  const factoryName = `${contractName}__factory`;
  const ctor = _findConstructor(abi);
  const ctorInputs = (ctor && ctor.inputs) || [];
  const deployArgsNames = ctorInputs.map((p, i) => _safeIdent(p.name || `arg${i}`)).join(", ");

  const lines = [];
  lines.push(`// Auto-generated by sdkgen`);
  lines.push(`const { ContractFactory, getCreateAddress } = require("quantumcoin");`);
  lines.push(`const { ${contractName} } = require("./${contractName}");`);
  lines.push("");
  lines.push(`class ${factoryName} extends ContractFactory {`);
  lines.push(`  constructor(runner) {`);
  lines.push(`    super(${contractName}.abi, ${contractName}.bytecode, runner);`);
  lines.push(`  }`);
  lines.push("");
  const taken = new Set(ctorInputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
  const [overridesId, signerId, fromId, providerId, nonceId, addressId, txReqId, safeOverridesId, kId, txId] = [
    "overrides", "signer", "from", "provider", "nonce", "address", "txReq", "safeOverrides", "k", "tx",
  ].map((n) => _uniqueIdent(n, taken));
  const prop = (key, id) => (id === key ? key : `${key}: ${id}`);

  lines.push(`  async deploy(${deployArgsNames}${deployArgsNames ? ", " : ""}${overridesId}) {`);
  lines.push(`    const ${signerId} = this.signer;`);
  lines.push(`    if (!${signerId}) { throw new Error("missing signer"); }`);
  lines.push(`    const ${fromId} = ${signerId}.getAddress ? await ${signerId}.getAddress() : ${signerId}.address;`);
  lines.push(`    const ${providerId} = ${signerId}.provider;`);
  lines.push(`    if (!${providerId} || !${providerId}.getTransactionCount) { throw new Error("missing provider"); }`);
  lines.push(`    let ${nonceId};`);
  lines.push(`    try { ${nonceId} = await ${providerId}.getTransactionCount(${fromId}, "pending"); } catch { ${nonceId} = await ${providerId}.getTransactionCount(${fromId}, "latest"); }`);
  lines.push(`    const ${addressId} = getCreateAddress({ ${prop("from", fromId)}, ${prop("nonce", nonceId)} });`);
  lines.push(`    const ${txReqId} = this.getDeployTransaction(${deployArgsNames});`);
  // Only allow-listed override fields may reach the signer; protected fields
  // (to/data from txReq, and the computed nonce) always win.
  lines.push(`    const ${safeOverridesId} = {};`);
  lines.push(
    `    for (const ${kId} of ["value", "gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "remarks", "signingContext"]) { if (${overridesId} && ${overridesId}[${kId}] !== undefined) ${safeOverridesId}[${kId}] = ${overridesId}[${kId}]; }`,
  );
  lines.push(`    const ${txId} = await ${signerId}.sendTransaction({ ...${txReqId}, ...${safeOverridesId}, ${prop("nonce", nonceId)} });`);
  lines.push(`    return new ${contractName}(${addressId}, ${signerId}, ${txId});`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  static connect(address, runner) {`);
  lines.push(`    return ${contractName}.connect(address, runner);`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push("");
  lines.push(`module.exports = { ${factoryName} };`);
  lines.push("");
  return lines.join("\n");
}

function _renderFactoryDts({ contractName, abi }) {
  const factoryName = `${contractName}__factory`;
  const ctor = _findConstructor(abi);
  const ctorInputs = (ctor && ctor.inputs) || [];
  const tupleReg = _collectTupleRegistry(contractName, abi);
  const deployArgsSig = ctorInputs.map((p, i) => `${_safeIdent(p.name || `arg${i}`)}: ${_solParamToTs(p, "input", tupleReg)}`).join(", ");

  const lines = [];
  lines.push(`// Auto-generated by sdkgen`);
  lines.push(`import { ContractFactory, ContractRunner } from "quantumcoin";`);
  lines.push(`import { ${contractName} } from "./${contractName}";`);
  lines.push(`import type * as Types from "./types";`);

  const ctorTupleTypes = new Set();
  const visit = (p) => {
    const t = String(p && p.type ? p.type : "");
    const arr = _parseArray(t);
    if (arr) return visit({ ...(p || {}), type: arr.inner });
    if (t === "tuple") {
      const key = _tupleKey(p);
      const base = tupleReg.byKey.get(key);
      if (base) ctorTupleTypes.add(`${base}Input`);
      const comps = Array.isArray(p && p.components) ? p.components : [];
      for (const c of comps) visit(c);
    }
  };
  for (const p of ctorInputs) visit(p);
  if (ctorTupleTypes.size) {
    lines.push(`import type { ${Array.from(ctorTupleTypes).sort().join(", ")} } from "./${contractName}";`);
  }
  lines.push("");
  const takenDts = new Set(ctorInputs.map((p, i) => _safeIdent(p.name || `arg${i}`)));
  const overridesId = _uniqueIdent("overrides", takenDts);
  lines.push(`export declare class ${factoryName} extends ContractFactory {`);
  lines.push(`  constructor(runner: ContractRunner);`);
  lines.push(`  deploy(${deployArgsSig}${deployArgsSig ? ", " : ""}${overridesId}?: any): Promise<${contractName}>;`);
  lines.push(`  static connect(address: string, runner?: ContractRunner): ${contractName};`);
  lines.push(`}`);
  return lines.join("\n") + "\n";
}

function _renderIndexTs(contractNames) {
  const lines = [];
  lines.push(`// Auto-generated by sdkgen`);
  lines.push(`export * from "./types";`);
  for (const name of contractNames) {
    lines.push(`export * from "./${name}";`);
    lines.push(`export * from "./${name}__factory";`);
  }
  return lines.join("\n") + "\n";
}

function _renderIndexJs(contractNames) {
  const lines = [];
  lines.push(`// Auto-generated by sdkgen`);
  lines.push("");
  lines.push(`Object.assign(exports, require("./types"));`);
  for (const name of contractNames) {
    lines.push(`exports.${name} = require("./${name}").${name};`);
    lines.push(`exports.${name}__factory = require("./${name}__factory").${name}__factory;`);
  }
  lines.push("");
  return lines.join("\n");
}

function _renderIndexDts(contractNames) {
  const lines = [];
  lines.push(`// Auto-generated by sdkgen`);
  lines.push(`export * from "./types";`);
  for (const name of contractNames) {
    lines.push(`export * from "./${name}";`);
    lines.push(`export * from "./${name}__factory";`);
  }
  return lines.join("\n") + "\n";
}

/**
 * Generate a transactional e2e test file (JavaScript) for the typed contract package.
 * The test deploys the contract with constructor args (if any) and invokes one write method.
 *
 * When `bytecode` is omitted, empty, or `"0x"` the contract is treated as an interface:
 * the generated test still attempts the deploy (the receipt-status assertion still validates
 * SDK wrapper wiring) but the post-deploy `provider.getCode(...)` bytecode assertion is
 * skipped, since interfaces deploy with no runtime code by design.
 *
 * @param {{ contractName: string, abi: any[], bytecode?: string }} opts
 * @returns {string}
 */
function generateTransactionalTestJs(opts) {
  const { contractName, abi, bytecode } = opts;
  // This renders `${contractName}`, `${contractName}__factory` and method
  // names directly into JS source and a require() specifier.
  _assertSafeIdentifier(contractName, "contract name");
  _assertSafeAbiNames(abi);
  const isInterface = _isInterfaceBytecode(bytecode);
  const factoryName = `${contractName}__factory`;
  const ctor = _findConstructor(abi);
  const ctorInputs = ctor.inputs || [];

  const ctorArgsExpr = ctorInputs.map((i) => _solTypeToTestValueExpr(i)).join(", ");

  // ---------------------------------------------------------------------------
  // ERC-20 style assertions (optional)
  // ---------------------------------------------------------------------------
  const fnByName = (name) => (abi || []).find((f) => f && f.type === "function" && f.name === name);
  const nameFn = fnByName("name");
  const supplyFn = fnByName("totalSupply") || fnByName("supply");
  const balanceOfFn = fnByName("balanceOf");

  const isViewNoArgs = (f) =>
    !!(
      f &&
      f.type === "function" &&
      (f.stateMutability === "view" || f.stateMutability === "pure") &&
      (f.inputs || []).length === 0
    );
  const isViewBalanceOf = (f) =>
    !!(
      f &&
      f.type === "function" &&
      (f.stateMutability === "view" || f.stateMutability === "pure") &&
      (f.inputs || []).length === 1 &&
      (f.inputs[0].type || "") === "address"
    );
  const isStringOut = (f) => !!(f && (f.outputs || []).length === 1 && (f.outputs[0].type || "") === "string");
  const isUintOut = (f) => !!(f && (f.outputs || []).length === 1 && String(f.outputs[0].type || "").startsWith("uint"));

  const hasErc20Surface =
    isViewNoArgs(nameFn) && isStringOut(nameFn) && isViewNoArgs(supplyFn) && isUintOut(supplyFn) && isViewBalanceOf(balanceOfFn) && isUintOut(balanceOfFn);

  // Common ERC-20 constructor: (string name, string symbol, uint256 initialSupply)
  const isErc20Ctor =
    ctorInputs.length === 3 &&
    (ctorInputs[0].type || "") === "string" &&
    (ctorInputs[1].type || "") === "string" &&
    String(ctorInputs[2].type || "").startsWith("uint");

  const erc20TokenName = "TestToken";
  const erc20TokenSymbol = "TT";
  const erc20InitialSupply = 1000;
  const deployArgsExpr = hasErc20Surface && isErc20Ctor ? `${JSON.stringify(erc20TokenName)}, ${JSON.stringify(erc20TokenSymbol)}, ${erc20InitialSupply}` : ctorArgsExpr;
  const supplyMethodName = supplyFn && typeof supplyFn.name === "string" ? supplyFn.name : "totalSupply";
  const erc20Assertions =
    hasErc20Surface && isErc20Ctor
      ? `// ERC-20 assertions (name / supply / balanceOf)
    const nm = await contract.name();
    assert.equal(nm, ${JSON.stringify(erc20TokenName)});

    // Generated wrappers already unwrap single-return values to a hard type (bigint for uints).
    const supply = await contract.${supplyMethodName}();
    assert.equal(supply, ${erc20InitialSupply}n);

    // Generated wrappers already unwrap single-return values to a hard type (bigint for uints).
    const bal = await contract.balanceOf(wallet.address);
    assert.equal(bal, ${erc20InitialSupply}n);
`
      : "";

  // Pick first view function with no inputs for state reads (optional).
  const viewNoArg = (abi || []).find(
    (f) => f && f.type === "function" && (f.stateMutability === "view" || f.stateMutability === "pure") && (f.inputs || []).length === 0,
  );

  // Pick first state-changing function with supported params (prefer 1-arg numeric setter patterns).
  const writeFn =
    (abi || []).find((f) => {
      if (!f || f.type !== "function") return false;
      if (f.stateMutability === "view" || f.stateMutability === "pure") return false;
      if (!_allSupportedParams(f.inputs)) return false;
      return f.name === "set" && (f.inputs || []).length === 1 && (f.inputs[0].type || "").startsWith("uint");
    }) ||
    (abi || []).find(
      (f) => f && f.type === "function" && !(f.stateMutability === "view" || f.stateMutability === "pure") && _allSupportedParams(f.inputs),
    );

  const writeName = writeFn ? writeFn.name : null;
  const writeArgsExpr =
    writeFn && (writeFn.inputs || []).length === 1 && (writeFn.inputs[0].type || "").startsWith("uint")
      ? "456"
      : writeFn
        ? (writeFn.inputs || []).map((i) => _solTypeToTestValueExpr(i)).join(", ")
        : "";

  const canAssertValueChange =
    !!(
      viewNoArg &&
      (viewNoArg.outputs || []).length === 1 &&
      typeof viewNoArg.outputs[0].type === "string" &&
      (viewNoArg.outputs[0].type.startsWith("uint") || viewNoArg.outputs[0].type.startsWith("int")) &&
      writeFn &&
      (writeFn.inputs || []).length === 1 &&
      typeof writeFn.inputs[0].type === "string" &&
      (writeFn.inputs[0].type.startsWith("uint") || writeFn.inputs[0].type.startsWith("int"))
    );

  return `/**
 * @testCategory e2e
 * @blockchainRequired write
 * @description Auto-generated transactional tests for ${contractName}
 *
 * WARNING:
 * - This test uses a HARDCODED TEST WALLET (encrypted JSON + passphrase).
 * - It assumes the wallet has funds on the target network.
 * - It will broadcast real transactions and change chain state.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { Initialize } = require("quantumcoin/config");
const { getProvider, Wallet } = require("quantumcoin");

// NOTE: this test file lives at test/e2e/*.js, so package root is two levels up.
// Require the package root so it works for both TS (dist) and JS (src) packages.
const { ${contractName}, ${factoryName} } = require("../..");

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

describe("${contractName} transactional", () => {
  it("deploys and invokes contract", async (t) => {
    const rpcUrl = process.env.QC_RPC_URL;
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }

    const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
    await Initialize(null);

    const provider = getProvider(rpcUrl, chainId);
    const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);

    const factory = new ${factoryName}(wallet);
    // Build deploy transaction + estimate gas (best-effort).
    const deployTxReq = factory.getDeployTransaction(${deployArgsExpr});
    let deployGasLimit = 600000;
    try {
      const est = await provider.estimateGas({ from: wallet.address, data: deployTxReq.data });
      deployGasLimit = Number(est + 200_000n);
    } catch {
      // Keep fallback. Some RPCs do not support estimateGas for create.
      deployGasLimit = 6_000_000;
    }
    // Some large contracts underestimate gas; apply a sane floor based on bytecode size.
    const bytecodeSize = (${contractName}.bytecode || "").length;
    if (bytecodeSize > 20000 && deployGasLimit < 6_000_000) deployGasLimit = 6_000_000;

    const contract = await factory.deploy(${deployArgsExpr}${deployArgsExpr ? ", " : ""}{ gasLimit: deployGasLimit });

    const deployTx = contract.deployTransaction();
    assert.ok(deployTx && deployTx.hash);
    const deployReceipt = await deployTx.wait(1, 600_000);
    assert.ok(deployReceipt);
    assert.ok(deployReceipt.blockNumber != null);

    ${isInterface
      ? `// Skipping bytecode check: ${contractName} is an interface (no bytecode).`
      : `const code = await provider.getCode(contract.target, "latest");
    assert.ok(code && code !== "0x");`}

    ${erc20Assertions ? erc20Assertions : `// (no ERC-20 surface detected for extra assertions)`}

    ${viewNoArg ? `// Basic view call
    const before = await contract.${viewNoArg.name}();
    void before;` : `// No zero-arg view method detected; deployment is still validated.`}

    ${writeName ? `// Write call + wait
    const tx = await contract.${writeName}(${writeArgsExpr}${writeArgsExpr ? ", " : ""}{ gasLimit: 200000 });
    await tx.wait(1, 600_000);` : `// No supported write method detected for auto invocation.`}

    ${canAssertValueChange ? `// Assert value change (best-effort; normalize to BigInt)
    const after = await contract.${viewNoArg.name}();
    assert.equal(after, 456n);` : `// No compatible getter+setter pair detected for value assertions.`}
  }, { timeout: 900_000 });
});
`;
}

/**
 * For a single contract ABI, compute deploy args and optional view/write method for e2e.
 * @param {{ contractName: string, abi: any[] }} opts
 * @returns {{ ctorArgsExpr: string, deployArgsExpr: string, viewName: string | null, writeName: string | null, writeArgsExpr: string }}
 */
function _getContractTestMeta(opts) {
  const { contractName, abi } = opts;
  const ctor = _findConstructor(abi);
  const ctorInputs = ctor.inputs || [];
  const ctorArgsExpr = ctorInputs.map((i) => _solTypeToTestValueExpr(i)).join(", ");
  const viewNoArg = (abi || []).find(
    (f) => f && f.type === "function" && (f.stateMutability === "view" || f.stateMutability === "pure") && (f.inputs || []).length === 0,
  );
  const writeFn =
    (abi || []).find(
      (f) =>
        f && f.type === "function" && !(f.stateMutability === "view" || f.stateMutability === "pure") && f.name === "set" &&
        (f.inputs || []).length === 1 &&
        (f.inputs[0].type || "").startsWith("uint") &&
        _allSupportedParams(f.inputs),
    ) ||
    (abi || []).find(
      (f) => f && f.type === "function" && !(f.stateMutability === "view" || f.stateMutability === "pure") && _allSupportedParams(f.inputs),
    );
  const writeArgsExpr =
    writeFn && (writeFn.inputs || []).length === 1 && (writeFn.inputs[0].type || "").startsWith("uint")
      ? "456"
      : writeFn
        ? (writeFn.inputs || []).map((i) => _solTypeToTestValueExpr(i)).join(", ")
        : "";
  return {
    ctorArgsExpr,
    deployArgsExpr: ctorArgsExpr,
    viewName: viewNoArg ? viewNoArg.name : null,
    writeName: writeFn ? writeFn.name : null,
    writeArgsExpr,
  };
}

/**
 * Generate a single transactional e2e test that deploys and invokes methods on ALL contracts.
 * Used when the package has multiple contracts so one test exercises every contract.
 *
 * Accepts `bytecode` per artifact for forward-compatibility, although the multi-contract
 * template currently emits no `getCode` assertion (so the value is not yet consumed).
 *
 * @param {{ artifacts: Array<{ contractName: string, abi: any[], bytecode?: string }> }} opts
 * @returns {string}
 */
function generateAllContractsTransactionalTestJs(opts) {
  const { artifacts } = opts;
  if (!artifacts || artifacts.length < 2) {
    throw new Error("generateAllContractsTransactionalTestJs requires at least 2 artifacts");
  }

  // Contract names and method names are interpolated into source + require().
  for (const a of artifacts) {
    _assertSafeIdentifier(a && a.contractName, "contract name");
    _assertSafeAbiNames(a && a.abi);
  }

  const requireNames = [];
  for (const a of artifacts) {
    requireNames.push(a.contractName, `${a.contractName}__factory`);
  }
  const requireLine = `const { ${requireNames.join(", ")} } = require("../..");`;

  const blocks = [];
  for (const a of artifacts) {
    const meta = _getContractTestMeta({ contractName: a.contractName, abi: a.abi });
    const factoryName = `${a.contractName}__factory`;
    const deployRhs =
      meta.ctorArgsExpr
        ? `await (new ${factoryName}(wallet)).deploy(${meta.deployArgsExpr}, { gasLimit: deployGasLimit })`
        : `await (new ${factoryName}(wallet)).deploy({ gasLimit: deployGasLimit })`;
    let invokeBlock = "";
    if (meta.viewName) {
      invokeBlock += `const _v = await ${a.contractName}Inst.${meta.viewName}();\n    void _v;\n`;
    }
    if (meta.writeName) {
      invokeBlock += `const _tx = await ${a.contractName}Inst.${meta.writeName}(${meta.writeArgsExpr}${meta.writeArgsExpr ? ", " : ""}{ gasLimit: 200000 });\n    await _tx.wait(1, 600_000);\n`;
    }
    blocks.push({
      contractName: a.contractName,
      factoryName,
      deployRhs,
      invokeBlock: invokeBlock || `// No view/write method detected for ${a.contractName}\n`,
    });
  }

  const deployAndInvokeBlocks = blocks
    .map(
      (b) => `
    let ${b.contractName}Inst = ${b.deployRhs};
    const _deployTx${b.contractName} = ${b.contractName}Inst.deployTransaction();
    assert.ok(_deployTx${b.contractName} && _deployTx${b.contractName}.hash);
    await _deployTx${b.contractName}.wait(1, 600_000);
    ${b.invokeBlock.trim().split("\n").join("\n    ")}`,
    )
    .join("\n");

  const firstMeta = _getContractTestMeta({ contractName: artifacts[0].contractName, abi: artifacts[0].abi });
  const firstCtorArgs = firstMeta.ctorArgsExpr ? firstMeta.ctorArgsExpr + ", " : "";

  return `/**
 * @testCategory e2e
 * @blockchainRequired write
 * @description Auto-generated test that deploys and invokes all contracts in this package.
 *
 * WARNING:
 * - This test uses a HARDCODED TEST WALLET (encrypted JSON + passphrase).
 * - It assumes the wallet has funds on the target network.
 * - It will broadcast real transactions and change chain state.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { Initialize } = require("quantumcoin/config");
const { getProvider, Wallet } = require("quantumcoin");

${requireLine}

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

describe("all contracts", () => {
  it("deploys and invokes all contracts", async (t) => {
    const rpcUrl = process.env.QC_RPC_URL;
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }

    const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
    await Initialize(null);

    const provider = getProvider(rpcUrl, chainId);
    const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);

    let deployGasLimit = 600000;
    try {
      const firstFactory = new ${artifacts[0].contractName}__factory(wallet);
      const sampleReq = firstFactory.getDeployTransaction(${firstMeta.ctorArgsExpr || ""});
      const est = await provider.estimateGas({ from: wallet.address, data: sampleReq.data });
      deployGasLimit = Number(est + 200_000n);
    } catch {
      deployGasLimit = 6_000_000;
    }
${deployAndInvokeBlocks}
  }, { timeout: ${Math.max(900_000, 300_000 * artifacts.length)}});
});
`;
}

/**
 * @typedef {Object} GenerateOptions
 * @property {string} abiPath
 * @property {string} binPath
 * @property {string} outDir
 * @property {string} contractName
 * @property {string=} packageName
 * @property {boolean=} createPackage
 * @property {Record<string,string>=} dependencies
 */

/**
 * Generate multiple typed contract files.
 * @param {{ outDir: string, artifacts: Array<{ contractName: string, abi: any[], bytecode: string }> }} opts
 * @returns {{ contracts: Array<{ contractFile: string, factoryFile: string }>, typesFile: string, indexFile: string }}
 */
function generateFromArtifacts(opts) {
  _ensureDir(opts.outDir);
  const lang = (opts && opts.lang) || "ts"; // "ts" | "js"
  if (lang !== "ts" && lang !== "js") {
    throw new Error(`Unsupported generator lang: ${lang}`);
  }

  // Reject attacker-controlled names before they are interpolated into
  // generated source or used to build output file paths.
  for (const a of opts.artifacts || []) {
    _assertSafeIdentifier(a && a.contractName, "contract name");
    _assertSafeAbiNames(a && a.abi);
  }

  const contractNames = opts.artifacts.map((a) => a.contractName);

  const typesFile = path.join(opts.outDir, lang === "ts" ? `types.ts` : `types.js`);
  const indexFile = path.join(opts.outDir, lang === "ts" ? `index.ts` : `index.js`);

  fs.writeFileSync(typesFile, lang === "ts" ? _typesTs() : _typesJs(), "utf8");

  // For JS generation, we also emit .d.ts files (TS declarations) so JS packages remain typed.
  const typesDtsFile = lang === "js" ? path.join(opts.outDir, `types.d.ts`) : null;
  const indexDtsFile = lang === "js" ? path.join(opts.outDir, `index.d.ts`) : null;
  if (lang === "js") {
    fs.writeFileSync(typesDtsFile, _typesDts(), "utf8");
  }

  const contracts = [];
  for (const a of opts.artifacts) {
    const contractFile = path.join(opts.outDir, `${a.contractName}.${lang === "ts" ? "ts" : "js"}`);
    const factoryFile = path.join(opts.outDir, `${a.contractName}__factory.${lang === "ts" ? "ts" : "js"}`);
    const contractDtsFile = lang === "js" ? path.join(opts.outDir, `${a.contractName}.d.ts`) : null;
    const factoryDtsFile = lang === "js" ? path.join(opts.outDir, `${a.contractName}__factory.d.ts`) : null;

    // Defense-in-depth — even though contractName is a validated identifier,
    // ensure no output path escapes the target directory.
    for (const f of [contractFile, factoryFile, contractDtsFile, factoryDtsFile]) {
      if (f) _assertWithinDir(opts.outDir, f);
    }

    if (lang === "ts") {
      fs.writeFileSync(
        contractFile,
        _renderContractTs({ contractName: a.contractName, abi: a.abi, bytecode: a.bytecode, docs: a.docs || null }),
        "utf8",
      );
      fs.writeFileSync(factoryFile, _renderFactoryTs({ contractName: a.contractName, abi: a.abi }), "utf8");
    } else {
      fs.writeFileSync(
        contractFile,
        _renderContractJs({ contractName: a.contractName, abi: a.abi, bytecode: a.bytecode, docs: a.docs || null }),
        "utf8",
      );
      fs.writeFileSync(factoryFile, _renderFactoryJs({ contractName: a.contractName, abi: a.abi }), "utf8");
    }

    if (lang === "js") {
      fs.writeFileSync(contractDtsFile, _renderContractDts({ contractName: a.contractName, abi: a.abi }), "utf8");
      fs.writeFileSync(factoryDtsFile, _renderFactoryDts({ contractName: a.contractName, abi: a.abi }), "utf8");
    }
    contracts.push({ contractFile, factoryFile });
  }

  fs.writeFileSync(indexFile, lang === "ts" ? _renderIndexTs(contractNames) : _renderIndexJs(contractNames), "utf8");
  if (lang === "js") {
    fs.writeFileSync(indexDtsFile, _renderIndexDts(contractNames), "utf8");
  }

  if (lang === "js") {
    return { contracts, typesFile, indexFile, typesDtsFile, indexDtsFile };
  }
  return { contracts, typesFile, indexFile };
}

/**
 * Generate typed contract files.
 * @param {GenerateOptions} opts
 * @returns {{ contractFile: string, factoryFile: string, typesFile: string, indexFile: string }}
 */
function generate(opts) {
  const abi = _readJson(opts.abiPath);
  const bytecodeRaw = fs.readFileSync(opts.binPath, "utf8").trim();
  const bytecode = bytecodeRaw.startsWith("0x") ? bytecodeRaw : "0x" + bytecodeRaw;

  _ensureDir(opts.outDir);
  const contractName = opts.contractName;

  const res = generateFromArtifacts({
    outDir: opts.outDir,
    artifacts: [{ contractName, abi, bytecode }],
    lang: opts.lang || "ts",
  });

  const contractFile = res.contracts[0].contractFile;
  const factoryFile = res.contracts[0].factoryFile;
  return { contractFile, factoryFile, typesFile: res.typesFile, indexFile: res.indexFile };
}

module.exports = {
  generate,
  generateFromArtifacts,
  generateTransactionalTestJs,
  generateAllContractsTransactionalTestJs,
  assertSafeIdentifier: _assertSafeIdentifier,
};

