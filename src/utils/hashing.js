/**
 * @fileoverview Hash utilities (ethers.js v6 compatible names).
 *
 * All cryptographic primitives are provided by `quantum-coin-js-sdk`, which
 * runs in both Node.js and modern browsers (WebAssembly + Web Crypto). This
 * keeps the SDK platform agnostic and free of Node's built-in `crypto` module.
 *
 * NOTE: The underlying primitives require the SDK to be initialized. Call
 * `Initialize()` (see the `quantumcoin/config` module) before using these
 * helpers, otherwise a `NOT_INITIALIZED` error is thrown.
 */

const qcsdk = require("quantum-coin-js-sdk");
const { arrayify, bytesToHex, utf8ToBytes } = require("../internal/hex");
const { makeError } = require("../errors");

// quantum-coin-js-sdk returns -1000 from crypto helpers when the SDK has not
// been initialized yet, and null when the input is invalid.
const _NOT_INITIALIZED = -1000;

/**
 * Convert a byte array returned by a quantum-coin-js-sdk crypto helper into a
 * normalized hex string, throwing a clear error when the SDK is not
 * initialized or the operation failed.
 * @param {number[]|Uint8Array|number|null} result
 * @param {string} operation
 * @returns {string}
 */
function _hexFromQcsdk(result, operation) {
  if (result === _NOT_INITIALIZED) {
    throw makeError(
      "quantum-coin-js-sdk not initialized; call Initialize() first",
      "NOT_INITIALIZED",
      { operation },
    );
  }
  if (result == null || typeof result === "number") {
    throw makeError(`${operation} failed`, "UNKNOWN_ERROR", { operation });
  }
  return bytesToHex(result instanceof Uint8Array ? result : Uint8Array.from(result));
}

/**
 * keccak256 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
function keccak256(data) {
  const bytes = arrayify(data);
  return _hexFromQcsdk(qcsdk.keccak256(bytes), "keccak256");
}

/**
 * sha256 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
function sha256(data) {
  const bytes = arrayify(data);
  return _hexFromQcsdk(qcsdk.sha256(bytes), "sha256");
}

/**
 * sha512 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
function sha512(data) {
  const bytes = arrayify(data);
  return _hexFromQcsdk(qcsdk.sha512(bytes), "sha512");
}

/**
 * ripemd160 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
function ripemd160(data) {
  const bytes = arrayify(data);
  return _hexFromQcsdk(qcsdk.ripemd160(bytes), "ripemd160");
}

/**
 * ethers-style id(text) => keccak256(utf8Bytes(text))
 * @param {string} text
 * @returns {string}
 */
function id(text) {
  return keccak256(utf8ToBytes(text));
}

/**
 * Compute the EIP-191 "personal message" digest for a message.
 *
 * QuantumCoin uses the exact same prefix as Ethereum, so this is byte-for-byte
 * compatible with `personal_sign` in `quantum-coin-go`:
 *
 *   keccak256("\x19Ethereum Signed Message:\n" + message.length + message)
 *
 * The resulting 32-byte hash is the digest passed to `Wallet.signMessage` /
 * `Wallet.signMessageSync` and re-derived by `verifyMessage`. The decimal length
 * prefix counts message BYTES, not characters. A string message is UTF-8
 * encoded; a Uint8Array (or 0x hex string coerced via `arrayify`) is treated as
 * raw bytes.
 *
 * @param {string|Uint8Array} message The message to hash. Strings are UTF-8 encoded.
 * @returns {string} 0x-prefixed, 32-byte keccak256 digest.
 */
function hashMessage(message) {
  const msgBytes = typeof message === "string" ? utf8ToBytes(message) : arrayify(message);
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const composed = new Uint8Array(prefix.length + msgBytes.length);
  composed.set(prefix, 0);
  composed.set(msgBytes, prefix.length);
  return keccak256(composed);
}

/**
 * Generate cryptographically strong random bytes.
 *
 * Uses the platform Web Crypto API (`globalThis.crypto`), which is available in
 * modern browsers and Node.js 20+.
 * @param {number} length
 * @returns {Uint8Array}
 */
function randomBytes(length) {
  const webcrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (!webcrypto || typeof webcrypto.getRandomValues !== "function") {
    throw makeError(
      "secure random source (globalThis.crypto.getRandomValues) not available in this environment",
      "UNKNOWN_ERROR",
      { operation: "randomBytes" },
    );
  }
  const out = new Uint8Array(length);
  // getRandomValues rejects requests larger than 65536 bytes; fill in chunks.
  const MAX_CHUNK = 65536;
  for (let offset = 0; offset < length; offset += MAX_CHUNK) {
    const chunk = out.subarray(offset, Math.min(offset + MAX_CHUNK, length));
    webcrypto.getRandomValues(chunk);
  }
  return out;
}

/**
 * Compute HMAC over data.
 * @param {string} algorithm "sha256" or "sha512"
 * @param {string|Uint8Array} key
 * @param {string|Uint8Array} data
 * @returns {string}
 */
function computeHmac(algorithm, key, data) {
  const k = typeof key === "string" ? utf8ToBytes(key) : arrayify(key);
  const d = typeof data === "string" ? utf8ToBytes(data) : arrayify(data);
  return _hexFromQcsdk(qcsdk.computeHmac(algorithm, k, d), "computeHmac");
}

/**
 * PBKDF2 (sync) helper returning hex string.
 * @param {string|Uint8Array} password
 * @param {string|Uint8Array} salt
 * @param {number} iterations
 * @param {number} keylen
 * @param {string=} algorithm "sha256" (default) or "sha512"
 * @returns {string}
 */
function pbkdf2(password, salt, iterations, keylen, algorithm) {
  const p = typeof password === "string" ? utf8ToBytes(password) : arrayify(password);
  const s = typeof salt === "string" ? utf8ToBytes(salt) : arrayify(salt);
  const a = algorithm || "sha256";
  return _hexFromQcsdk(qcsdk.pbkdf2(p, s, iterations, keylen, a), "pbkdf2");
}

/**
 * scrypt (sync) helper returning hex string.
 * @param {string|Uint8Array} password
 * @param {string|Uint8Array} salt
 * @param {number} N
 * @param {number} r
 * @param {number} p
 * @param {number} dkLen
 * @returns {string}
 */
function scryptSync(password, salt, N, r, p, dkLen) {
  const pw = typeof password === "string" ? utf8ToBytes(password) : arrayify(password);
  const sa = typeof salt === "string" ? utf8ToBytes(salt) : arrayify(salt);
  return _hexFromQcsdk(qcsdk.scryptDeriveKey(pw, sa, N, r, p, dkLen), "scrypt");
}

/**
 * scrypt (async) helper returning hex string.
 * @param {string|Uint8Array} password
 * @param {string|Uint8Array} salt
 * @param {number} N
 * @param {number} r
 * @param {number} p
 * @param {number} dkLen
 * @returns {Promise<string>}
 */
function scrypt(password, salt, N, r, p, dkLen) {
  return Promise.resolve().then(() => scryptSync(password, salt, N, r, p, dkLen));
}

module.exports = {
  keccak256,
  sha256,
  sha512,
  ripemd160,
  id,
  hashMessage,
  randomBytes,
  computeHmac,
  pbkdf2,
  scrypt,
  scryptSync,
};
