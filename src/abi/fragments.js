/**
 * @fileoverview Minimal ABI fragment classes (ethers.js v6 compatible surface).
 *
 * This SDK keeps fragment handling lightweight and delegates ABI encoding/decoding
 * to `quantum-coin-js-sdk` (WASM).
 */

class Fragment {
  /**
   * @param {any} fragment
   */
  constructor(fragment) {
    this.type = fragment?.type;
    this.name = fragment?.name;
    this.inputs = fragment?.inputs || [];
    this.outputs = fragment?.outputs || [];
    this.stateMutability = fragment?.stateMutability;
    this.anonymous = fragment?.anonymous;
  }

  /**
   * Formats the fragment.
   * @param {string=} format
   * @returns {string}
   */
  format(format) {
    // For now, return JSON-ish format (compatible enough for tooling).
    // ethers supports "sighash", "full", etc.
    void format;
    return JSON.stringify(this.toJSON());
  }

  /**
   * @returns {any}
   */
  toJSON() {
    const out = {};
    for (const k of ["type", "name", "inputs", "outputs", "stateMutability", "anonymous"]) {
      if (this[k] != null) out[k] = this[k];
    }
    return out;
  }
}

class NamedFragment extends Fragment {}

class FunctionFragment extends NamedFragment {
  /**
   * The 4-byte function selector (sighash), e.g. "0xa9059cbb". Requires the SDK
   * to be initialized (uses keccak256). Mirrors ethers.js v6.
   * @returns {string}
   */
  get selector() {
    // Lazy require to keep fragment construction dependency-free.
    // eslint-disable-next-line global-require
    const { functionSelectorHex } = require("./js-abi-coder");
    return functionSelectorHex(this.name, Array.isArray(this.inputs) ? this.inputs : []);
  }
}

class EventFragment extends NamedFragment {
  /**
   * The event topic hash (topic0). Requires the SDK to be initialized (uses
   * keccak256). Mirrors ethers.js v6.
   * @returns {string}
   */
  get topicHash() {
    // eslint-disable-next-line global-require
    const { canonicalType } = require("./js-abi-coder");
    // eslint-disable-next-line global-require
    const { id } = require("../utils/hashing");
    // eslint-disable-next-line global-require
    const { normalizeHex } = require("../internal/hex");
    const inputs = Array.isArray(this.inputs) ? this.inputs : [];
    return normalizeHex(id(`${this.name}(${inputs.map((i) => canonicalType(i)).join(",")})`));
  }
}

class ErrorFragment extends NamedFragment {
  /**
   * The 4-byte error selector. Requires the SDK to be initialized (uses
   * keccak256). Mirrors ethers.js v6.
   * @returns {string}
   */
  get selector() {
    // eslint-disable-next-line global-require
    const { functionSelectorHex } = require("./js-abi-coder");
    return functionSelectorHex(this.name, Array.isArray(this.inputs) ? this.inputs : []);
  }
}

class ConstructorFragment extends Fragment {}
class StructFragment extends Fragment {}
class FallbackFragment extends Fragment {}

module.exports = {
  Fragment,
  NamedFragment,
  FunctionFragment,
  EventFragment,
  ErrorFragment,
  ConstructorFragment,
  StructFragment,
  FallbackFragment,
};

