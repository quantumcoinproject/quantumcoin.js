/**
 * keccak256 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
export function keccak256(data: string | Uint8Array): string;
/**
 * sha256 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
export function sha256(data: string | Uint8Array): string;
/**
 * sha512 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
export function sha512(data: string | Uint8Array): string;
/**
 * ripemd160 hash of BytesLike.
 * @param {string|Uint8Array} data
 * @returns {string}
 */
export function ripemd160(data: string | Uint8Array): string;
/**
 * ethers-style id(text) => keccak256(utf8Bytes(text))
 * @param {string} text
 * @returns {string}
 */
export function id(text: string): string;
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
export function hashMessage(message: string | Uint8Array): string;
/**
 * Generate cryptographically strong random bytes.
 *
 * Uses the platform Web Crypto API (`globalThis.crypto`), which is available in
 * modern browsers and Node.js 20+.
 * @param {number} length
 * @returns {Uint8Array}
 */
export function randomBytes(length: number): Uint8Array;
/**
 * Compute HMAC over data.
 * @param {string} algorithm "sha256" or "sha512"
 * @param {string|Uint8Array} key
 * @param {string|Uint8Array} data
 * @returns {string}
 */
export function computeHmac(algorithm: string, key: string | Uint8Array, data: string | Uint8Array): string;
/**
 * PBKDF2 (sync) helper returning hex string.
 * @param {string|Uint8Array} password
 * @param {string|Uint8Array} salt
 * @param {number} iterations
 * @param {number} keylen
 * @param {string=} algorithm "sha256" (default) or "sha512"
 * @returns {string}
 */
export function pbkdf2(password: string | Uint8Array, salt: string | Uint8Array, iterations: number, keylen: number, algorithm?: string | undefined): string;
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
export function scrypt(password: string | Uint8Array, salt: string | Uint8Array, N: number, r: number, p: number, dkLen: number): Promise<string>;
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
export function scryptSync(password: string | Uint8Array, salt: string | Uint8Array, N: number, r: number, p: number, dkLen: number): string;
