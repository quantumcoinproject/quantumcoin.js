/**
 * @fileoverview Wallet and signer implementations.
 *
 * The QuantumCoin.js wallet model mirrors ethers.js v6:
 * - AbstractSigner -> BaseWallet -> Wallet
 * - NonceManager wrapper
 *
 * Cryptographic operations are delegated to `quantum-coin-js-sdk`.
 */

const qcsdk = require("quantum-coin-js-sdk");
const seedWords = require("seed-words");
const { JsonRpcProvider } = require("../providers/json-rpc-provider");
const { assertArgument, assertSecretArgument, makeError } = require("../errors");
const { arrayify, bytesToHex, bytesToUtf8, hexToBytes, isHexString, normalizeHex, utf8ToBytes } = require("../internal/hex");
const { computeAddress, getAddress } = require("../utils/address");
const { hashMessage } = require("../utils/hashing");
const { WeiPerEther } = require("../constants");

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
  throw makeError("QuantumCoin SDK not initialized. Call Initialize() first.", "UNKNOWN_ERROR", { operation: "wallet" });
}

function _bytesToNumberArray(bytes) {
  return Array.from(bytes);
}

// Upper bound on the message size accepted by signMessage/signMessageSync. The
// message is only ever hashed to a 32-byte digest, so there is no protocol need
// for large inputs; this cap is a guardrail against accidentally signing an
// unbounded buffer (e.g. a whole file passed in by mistake). 1 MiB is far larger
// than any realistic personal_sign payload.
const MAX_MESSAGE_BYTES = 1024 * 1024;

/**
 * Verify that a private/public key pair is internally consistent (the public
 * key really corresponds to the private key). Constructing a wallet from a
 * mismatched pair must fail loudly here rather than silently producing a wallet
 * that signs with one key but claims another.
 *
 * NOTE: `qcsdk.verifyWallet` requires the raw (non-`0x`-prefixed) address form,
 * so we build the verification wallet from `addressFromPublicKey` directly
 * (mirroring the original `fromKeys` flow) rather than reusing a wallet that may
 * carry a normalized `0x` address.
 *
 * @param {Uint8Array} privateKeyBytes
 * @param {Uint8Array} publicKeyBytes
 */
function _assertKeyPairValid(privateKeyBytes, publicKeyBytes) {
  const privArr = _bytesToNumberArray(privateKeyBytes);
  const pubArr = _bytesToNumberArray(publicKeyBytes);
  const addr = qcsdk.addressFromPublicKey(pubArr);
  if (typeof addr !== "string") throw makeError("addressFromPublicKey failed", "UNKNOWN_ERROR", {});
  const checkWallet = new qcsdk.Wallet(addr, privArr, pubArr);
  const verified = qcsdk.verifyWallet(checkWallet);
  if (verified !== true) {
    throw makeError("verifyWallet failed: the provided key pair is invalid", "INVALID_ARGUMENT", { verified });
  }
}

const _maxSafeInt = 0x1fffffffffffffn; // 2^53 - 1

function _getBigInt(value, name) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    assertArgument(Number.isInteger(value), "underflow", name, value);
    assertArgument(value >= -Number(_maxSafeInt) && value <= Number(_maxSafeInt), "overflow", name, value);
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (value === "0x" || value === "0X") return 0n;
    try { return BigInt(value); }
    catch { assertArgument(false, "invalid BigNumberish string", name, value); }
  }
  assertArgument(false, "invalid BigNumberish", name, value);
}

function _getNumber(value, name) {
  const bi = _getBigInt(value, name);
  assertArgument(bi >= -_maxSafeInt && bi <= _maxSafeInt, "overflow", name, value);
  return Number(bi);
}

// Key type / public-key-length constants. The quantum-coin-js-sdk defines these
// key types internally (KEY_TYPE_HYBRIDEDMLDSASLHDSA = 3,
// KEY_TYPE_HYBRIDEDMLDSASLHDSA5 = 5) but does not export them, so we mirror them
// here and derive the key type from the public key length.
const KEY_TYPE_HYBRIDEDMLDSASLHDSA = 3;
const KEY_TYPE_HYBRIDEDMLDSASLHDSA5 = 5;
const PUBLIC_KEY_LENGTH_KEYTYPE3 = 1408;
const PUBLIC_KEY_LENGTH_KEYTYPE5 = 2688;

/**
 * Maps a public key length to the wallet key type.
 * @param {number} pubLen
 * @returns {number} KEY_TYPE_HYBRIDEDMLDSASLHDSA (3) or KEY_TYPE_HYBRIDEDMLDSASLHDSA5 (5).
 * @throws if the public key length is unsupported.
 */
function _keyTypeFromPublicKeyLength(pubLen) {
  if (pubLen === PUBLIC_KEY_LENGTH_KEYTYPE3) return KEY_TYPE_HYBRIDEDMLDSASLHDSA;
  if (pubLen === PUBLIC_KEY_LENGTH_KEYTYPE5) return KEY_TYPE_HYBRIDEDMLDSASLHDSA5;
  throw makeError("unsupported public key size", "UNSUPPORTED_OPERATION", { publicKeyLength: pubLen });
}

/**
 * SigningKey wrapper (PQC private/public key bytes).
 */
class SigningKey {
  /**
   * @param {Uint8Array} privateKeyBytes
   * @param {Uint8Array} publicKeyBytes
   */
  constructor(privateKeyBytes, publicKeyBytes) {
    Object.defineProperty(this, "privateKeyBytes", {
      enumerable: false,
      configurable: false,
      writable: false,
      value: new Uint8Array(privateKeyBytes),
    });
    this.publicKeyBytes = new Uint8Array(publicKeyBytes);
  }

  toJSON() {
    return {};
  }
}

/**
 * AbstractSigner base (minimal).
 */
class AbstractSigner {
  /**
   * @param {import("../providers/provider").AbstractProvider|null} provider
   */
  constructor(provider) {
    this.provider = provider || null;
  }

  async getAddress() {
    throw makeError("getAddress not implemented", "NOT_IMPLEMENTED", {});
  }
}

/**
 * BaseWallet - core signing implementation.
 */
class BaseWallet extends AbstractSigner {
  /**
   * @param {SigningKey} signingKey
   * @param {import("../providers/provider").AbstractProvider|null=} provider
   * @param {{ address: string }=} precomputed
   * @param {any=} qcWallet Internal quantum-coin-js-sdk Wallet (optional)
   */
  constructor(signingKey, provider, precomputed, qcWallet) {
    super(provider || null);
    _requireInitialized();

    Object.defineProperty(this, "signingKey", {
      enumerable: false,
      configurable: false,
      writable: false,
      value: signingKey,
    });
    Object.defineProperty(this, "_qcWallet", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: qcWallet || null,
    });

    /** @type {string} */
    this.address = precomputed?.address || "";

    Object.defineProperty(this, "privateKey", {
      enumerable: false,
      get: () => bytesToHex(this.signingKey.privateKeyBytes),
    });

    Object.defineProperty(this, "publicKey", {
      enumerable: true,
      get: () => bytesToHex(this.signingKey.publicKeyBytes),
    });

    Object.defineProperty(this, "_seed", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: null,
    });

    Object.defineProperty(this, "seed", {
      enumerable: false,
      get: () => this._seed,
    });
  }

  toJSON() {
    return { address: this.address };
  }

  async getAddress() {
    return this.address;
  }

  /**
   * Sign a transaction using quantum-coin-js-sdk signRawTransaction().
   * @param {import("../providers/provider").TransactionRequest} tx
   * @returns {Promise<string>}
   */
  async signTransaction(tx) {
    const { raw } = await this._signDetailed(tx);
    return raw;
  }

  /**
   * Sign an arbitrary message using QuantumCoin's EIP-191 personal-message
   * scheme, synchronously.
   *
   * The message is hashed with {@link hashMessage} (the same
   * `keccak256("\x19Ethereum Signed Message:\n" + len + message)` digest used by
   * `personal_sign` in quantum-coin-go), producing a 32-byte digest that is then
   * signed with the wallet's post-quantum key.
   *
   * Unlike Ethereum's 65-byte `(r, s, v)` signature, the returned value is an
   * opaque, scheme-dependent multi-kilobyte blob whose first byte is the scheme
   * id and which EMBEDS the signer's public key. This is what allows
   * {@link verifyMessage} to recover the signer address without an ecrecover
   * primitive.
   *
   * @param {string|Uint8Array} message The message to sign (strings are UTF-8 encoded).
   *   Must be at most {@link MAX_MESSAGE_BYTES} (1 MiB) once UTF-8 encoded.
   * @param {number|null=} signingContext Optional signing context. When omitted or
   *   null, `quantum-coin-js-sdk` derives the compact context from the key type
   *   (0 for keyType 3, 1 for keyType 5); pass 2 to request the full-signature
   *   scheme for a keyType 3 wallet.
   * @returns {string} 0x-prefixed signature blob (public key embedded).
   * @throws {TypeError} INVALID_ARGUMENT if the message exceeds the size limit.
   */
  signMessageSync(message, signingContext) {
    _requireInitialized();
    const msgBytes = typeof message === "string" ? utf8ToBytes(message) : arrayify(message);
    assertArgument(
      msgBytes.length <= MAX_MESSAGE_BYTES,
      `message too long (max ${MAX_MESSAGE_BYTES} bytes)`,
      "message",
      msgBytes.length,
    );
    const digestArr = _bytesToNumberArray(hexToBytes(hashMessage(msgBytes)));
    const privArr = _bytesToNumberArray(this.signingKey.privateKeyBytes);
    const pubArr = _bytesToNumberArray(this.signingKey.publicKeyBytes);
    const ctx = signingContext == null ? null : signingContext;
    const res = qcsdk.sign(privArr, digestArr, ctx);
    if (!res || typeof res !== "object" || res.resultCode !== 0 || res.signature == null) {
      throw makeError("signMessage failed", "UNKNOWN_ERROR", {
        resultCode: res && typeof res === "object" ? res.resultCode : null,
      });
    }
    // qcsdk.sign returns the signature-only bytes. Combine the public key into
    // the blob (sig + pubKey) so the result is self-describing and verifyMessage
    // can recover the signer without a separately supplied public key.
    const sigArr = Array.from(res.signature);
    const combined = qcsdk.combinePublicKeySignature(pubArr, sigArr);
    if (typeof combined !== "string") {
      throw makeError("signMessage failed to combine public key with signature", "UNKNOWN_ERROR", {});
    }
    return normalizeHex(combined);
  }

  /**
   * Sign an arbitrary message (EIP-191). Async wrapper over
   * {@link BaseWallet#signMessageSync} that honors the ethers `Signer` interface
   * contract (`Signer.signMessage` is async); the underlying PQC signing is
   * synchronous.
   *
   * @param {string|Uint8Array} message The message to sign (strings are UTF-8 encoded).
   * @param {number|null=} signingContext Optional signing context (see signMessageSync).
   * @returns {Promise<string>} 0x-prefixed signature blob (public key embedded).
   */
  async signMessage(message, signingContext) {
    return this.signMessageSync(message, signingContext);
  }

  /**
   * Internal: sign a transaction and return both the raw serialized transaction
   * and the signer-computed transaction hash. The hash is later used to
   * verify that an untrusted RPC node broadcast exactly the transaction we
   * signed rather than substituting a different one.
   * @param {import("../providers/provider").TransactionRequest} tx
   * @returns {Promise<{ raw: string, hash: string|null }>}
   */
  async _signDetailed(tx) {
    _requireInitialized();
    assertArgument(tx && typeof tx === "object", "invalid tx", "tx", tx);

    const toAddress = tx.to == null ? null : getAddress(tx.to);
    const valueInWei = tx.value == null ? 0n : _getBigInt(tx.value, "tx.value");
    const gasLimit = tx.gasLimit == null ? 21000 : _getNumber(tx.gasLimit, "tx.gasLimit");

    const data = tx.data == null ? null : normalizeHex(tx.data);
    const remarks = tx.remarks == null ? null : normalizeHex(tx.remarks);

    if (remarks != null) {
      assertArgument(isHexString(remarks), "remarks must be hex string", "remarks", remarks);
      const remarkBytes = hexToBytes(remarks);
      assertArgument(remarkBytes.length <= 32, "remarks too long (max 32 bytes)", "remarks", remarks);
    }

    // Nonce must be provided or resolved from provider.
    let nonce = tx.nonce;
    if (nonce == null) {
      if (!this.provider) throw makeError("missing provider to resolve nonce", "UNKNOWN_ERROR", { operation: "signTransaction" });
      // Prefer pending to avoid nonce collisions with in-flight transactions.
      try {
        nonce = await this.provider.getTransactionCount(this.address, "pending");
      } catch {
        nonce = await this.provider.getTransactionCount(this.address, "latest");
      }
    }
    assertArgument(Number.isInteger(nonce) && nonce >= 0, "invalid nonce", "nonce", nonce);

    // `chainId` remains accepted from the tx (e.g. via contract overrides). We
    // intentionally do NOT assert it against the
    // provider here because `chainId` in quantum-coin-js-sdk (qcsdk) defaults to
    // 123123 internally — an unset chainId resolves to that network default rather
    // than being left unbound. Cross-chain replay risk is therefore bounded by the
    // qcsdk default; explicit per-call chainId overrides are caller responsibility.
    const chainId = tx.chainId != null ? tx.chainId : (this.provider && this.provider.chainId != null ? this.provider.chainId : null);
    const signingContext = tx.signingContext ?? null;

    // chainId is mandatory for signing. Without it the signed transaction is
    // not bound to a network and can be replayed on a different chain. Online
    // flows resolve chainId from the connected provider; offline signing must
    // pass tx.chainId explicitly.
    let chainIdNum = null;
    try {
      chainIdNum = chainId == null ? null : _getNumber(chainId, "tx.chainId");
    } catch {
      chainIdNum = null;
    }
    assertArgument(
      chainIdNum != null && chainIdNum >= 0,
      "chainId is required for signing; pass tx.chainId or connect to a provider",
      "chainId",
      chainId,
    );

    /** @type {any} */
    const qcWallet =
      this._qcWallet ||
      new qcsdk.Wallet(
        this.address,
        _bytesToNumberArray(this.signingKey.privateKeyBytes),
        _bytesToNumberArray(this.signingKey.publicKeyBytes),
      );

    const req = new qcsdk.TransactionSigningRequest(
      qcWallet,
      toAddress,
      valueInWei,
      nonce,
      data,
      gasLimit,
      remarks,
      chainId,
      signingContext,
    );
    const signResult = qcsdk.signRawTransaction(req);
    // quantum-coin-js-sdk returns a SignResult object: { resultCode, txnHash, txnData }
    if (!signResult || typeof signResult !== "object") {
      throw makeError("signRawTransaction failed", "UNKNOWN_ERROR", {});
    }
    if (typeof signResult.resultCode === "number" && signResult.resultCode !== 0) {
      throw makeError("signRawTransaction failed", "UNKNOWN_ERROR", {
        resultCode: signResult.resultCode,
        hash: signResult.txnHash || null,
      });
    }
    const raw = signResult.txnData;
    if (typeof raw !== "string") throw makeError("signRawTransaction did not return txnData", "UNKNOWN_ERROR", {});
    let hash = null;
    if (typeof signResult.txnHash === "string" && signResult.txnHash.length > 0) {
      hash = normalizeHex(signResult.txnHash).toLowerCase();
    }
    return { raw: normalizeHex(raw), hash };
  }

  /**
   * Signs and sends a transaction.
   * @param {import("../providers/provider").TransactionRequest} tx
   * @returns {Promise<import("../providers/provider").TransactionResponse>}
   */
  async sendTransaction(tx) {
    if (!this.provider) throw makeError("missing provider", "UNKNOWN_ERROR", { operation: "sendTransaction" });
    const { raw, hash } = await this._signDetailed({ ...tx, from: this.address });
    // Tell the provider which hash we expect so it can reject a node that
    // broadcasts (or echoes back) a different transaction than the one we signed.
    return this.provider.sendTransaction(raw, hash ? { expectedHash: hash } : undefined);
  }
}

/**
 * Wallet - convenience methods around BaseWallet.
 */
class Wallet extends BaseWallet {
  /**
   * @param {string|Uint8Array|SigningKey} key
   * @param {import("../providers/provider").AbstractProvider=} provider
   */
  constructor(key, provider) {
    _requireInitialized();

    let signingKey;
    let qcAddress;

    if (key instanceof SigningKey) {
      signingKey = key;
      // Compute address from public key
      const addr = qcsdk.addressFromPublicKey(_bytesToNumberArray(signingKey.publicKeyBytes));
      if (typeof addr !== "string") throw makeError("addressFromPublicKey failed", "UNKNOWN_ERROR", {});
      qcAddress = normalizeHex(addr);
    } else {
      const privBytes = typeof key === "string" ? hexToBytes(key) : arrayify(key);
      const pubHex = qcsdk.publicKeyFromPrivateKey(_bytesToNumberArray(privBytes));
      if (typeof pubHex !== "string") throw makeError("publicKeyFromPrivateKey failed", "UNKNOWN_ERROR", {});
      const pubBytes = hexToBytes(pubHex);
      const addr = qcsdk.addressFromPublicKey(_bytesToNumberArray(pubBytes));
      if (typeof addr !== "string") throw makeError("addressFromPublicKey failed", "UNKNOWN_ERROR", {});
      qcAddress = normalizeHex(addr);
      signingKey = new SigningKey(privBytes, pubBytes);
    }

    /** @type {any} */
    const qcWallet = new qcsdk.Wallet(
      qcAddress,
      _bytesToNumberArray(signingKey.privateKeyBytes),
      _bytesToNumberArray(signingKey.publicKeyBytes),
    );

    // Central choke point — every Wallet (createRandom/fromPhrase/fromSeed/
    // fromEncryptedJsonSync/fromKeys/connect all funnel through this constructor)
    // is verified for key-pair consistency before it can be used to sign.
    _assertKeyPairValid(signingKey.privateKeyBytes, signingKey.publicKeyBytes);

    super(signingKey, provider || null, { address: qcAddress }, qcWallet);
  }

  /**
   * Returns wallet address (sync).
   * @returns {string}
   */
  getAddress() {
    return this.address;
  }

  /**
   * Returns wallet balance.
   * @param {string=} blockTag
   * @returns {Promise<bigint>}
   */
  async getBalance(blockTag) {
    if (!this.provider) throw makeError("missing provider", "UNKNOWN_ERROR", { operation: "getBalance" });
    void blockTag;
    return this.provider.getBalance(this.address);
  }

  /**
   * Returns wallet nonce.
   * @param {string=} blockTag
   * @returns {Promise<number>}
   */
  async getTransactionCount(blockTag) {
    if (!this.provider) throw makeError("missing provider", "UNKNOWN_ERROR", { operation: "getTransactionCount" });
    return this.provider.getTransactionCount(this.address, blockTag);
  }

  /**
   * Encrypts and serializes this wallet to JSON. 
   * @param {string|Uint8Array} password
   * @returns {string}
   */
  encryptSync(password) {
    _requireInitialized();
    if (this._seed != null) {
      return Wallet.encryptSeedSync(hexToBytes(this._seed), password);
    }
    // A Uint8Array password is decoded as UTF-8 with NFC normalization below.
    // For arbitrary (non-UTF-8) byte passwords this is
    // lossy — invalid sequences become U+FFFD — so a binary password may not
    // round-trip and the keystore could fail to reopen. This is intentionally left
    // as-is because the password->key mapping is part of the shared QuantumCoin
    // keystore format owned by qcsdk (and interoperable with the Desktop/Mobile/Web
    // /CLI wallets); changing it risks breaking existing keystores and cross-app
    // interop. Prefer string passphrases. (Fixing correctly requires a keystore-spec
    // decision, not a local change.)
    const pw = typeof password === "string"
      ? password.normalize("NFC")
      : bytesToUtf8(arrayify(password)).normalize("NFC");
    assertSecretArgument(pw.length >= 12, "password must be at least 12 characters", "password");
    const json = qcsdk.serializeEncryptedWallet(this._qcWallet, pw);
    if (typeof json !== "string") throw makeError("serializeEncryptedWallet failed", "UNKNOWN_ERROR", {});
    return json;
  }

  /**
   * Encrypts raw seed bytes into a wallet JSON string (version 5 pre-expansion format).
   * The resulting JSON can be opened with `Wallet.fromEncryptedJsonSync()` or
   * Desktop/Mobile/Web/CLI wallet applications.
   * @param {number[]|Uint8Array} seed  Raw seed bytes: 64 (keyType 3), 72 (keyType 5), or 96 (legacy)
   * @param {string|Uint8Array} password  Passphrase (at least 12 characters)
   * @returns {string}
   */
  static encryptSeedSync(seed, password) {
    _requireInitialized();
    const seedArr = seed instanceof Uint8Array ? Array.from(seed) : seed;
    assertArgument(Array.isArray(seedArr), "seed must be an array of numbers or Uint8Array", "seed", seed);
    const allowedLengths = [64, 72, 96];
    assertArgument(allowedLengths.includes(seedArr.length), "seed must be 64, 72, or 96 bytes", "seed", seedArr.length);
    // See encryptSync — a Uint8Array password is decoded as UTF-8/NFC, which is
    // lossy for arbitrary byte passwords. Left as-is
    // because the password->key mapping is part of the shared qcsdk keystore format
    // (cross-app interop); prefer string passphrases.
    const pw = typeof password === "string"
      ? password.normalize("NFC")
      : bytesToUtf8(arrayify(password)).normalize("NFC");
    assertSecretArgument(pw.length >= 12, "password must be at least 12 characters", "password");
    const json = qcsdk.serializeSeedAsEncryptedWallet(seedArr, pw);
    if (typeof json !== "string") throw makeError("serializeSeedAsEncryptedWallet failed", "UNKNOWN_ERROR", {});
    return json;
  }

  /**
   * Returns the seed phrase (list of words) if this wallet has a seed, else null.
   * Derived from the stored pre-expansion seed via seed-words.getWordListFromSeedArray.
   *
   * Non-null for wallets created via createRandom, fromPhrase, fromSeed, and
   * fromEncryptedJsonSync when the JSON is a version-5 keystore produced by
   * encryptSync on a seed-bearing wallet or by encryptSeedSync.
   * Null for fromKeys and for v3/v4 keystores without preExpansionSeed.
   *
   * @returns {string[]|null}
   */
  getPhrase() {
    _requireInitialized();
    if (this._seed == null) return null;
    const bytes = Array.from(hexToBytes(this._seed));
    const words = seedWords.getWordListFromSeedArray(bytes);
    return Array.isArray(words) ? words : null;
  }

  /**
   * Returns the recommended signing context for this wallet.
   * Setting fullSign to true may incur additional gas cost.
   * @param {boolean|null=} fullSign  Defaults to false when null or omitted.
   * @returns {number}
   */
  getSigningContext(fullSign) {
    const fs = fullSign ?? false;
    const keyType = _keyTypeFromPublicKeyLength(this.signingKey.publicKeyBytes.length);
    if (keyType === KEY_TYPE_HYBRIDEDMLDSASLHDSA) {
      return fs ? 2 : 0;
    }
    return 1;
  }

  /**
   * Returns the key type of this wallet, derived from its public key length:
   * 3 (KEY_TYPE_HYBRIDEDMLDSASLHDSA) or 5 (KEY_TYPE_HYBRIDEDMLDSASLHDSA5).
   *
   * The key type drives gas-price selection via `getFeeData`. Note that the
   * underlying quantum-coin-js-sdk gas-price model supports only DynamicFeeTx
   * (dynamic-fee transactions); legacy/other transaction fee types are not supported.
   *
   * @returns {number} 3 or 5.
   * @throws if the public key length is unsupported.
   */
  getKeyType() {
    return _keyTypeFromPublicKeyLength(this.signingKey.publicKeyBytes.length);
  }

  /**
   * Returns a new wallet connected to a provider.
   * @param {import("../providers/provider").AbstractProvider} provider
   * @returns {Wallet}
   */
  connect(provider) {
    const w = new Wallet(this.signingKey, provider);
    w._qcWallet = this._qcWallet;
    w._seed = this._seed;
    return w;
  }

  /**
   * Creates a new random wallet.
   * @param {import("../providers/provider").AbstractProvider=} provider
   * @param {number|null=} keyType  Optional key type: null (default=3), 3, or 5
   * @returns {Wallet}
   */
  static createRandom(provider, keyType) {
    _requireInitialized();
    if (keyType != null) {
      assertArgument(
        keyType === KEY_TYPE_HYBRIDEDMLDSASLHDSA || keyType === KEY_TYPE_HYBRIDEDMLDSASLHDSA5,
        "keyType must be null, 3, or 5",
        "keyType",
        keyType,
      );
    }
    const words = qcsdk.newWalletSeedWords(keyType ?? null);
    if (!words || !Array.isArray(words)) {
      throw makeError("newWalletSeedWords failed", "UNKNOWN_ERROR", { result: words });
    }
    return Wallet.fromPhrase(words, provider);
  }

  /**
   * Creates a wallet from raw seed bytes.
   * @param {number[]} seed  Raw seed bytes: 64 (keyType 3), 72 (keyType 5), or 96 (legacy)
   * @param {import("../providers/provider").AbstractProvider=} provider
   * @returns {Wallet}
   */
  static fromSeed(seed, provider) {
    _requireInitialized();
    assertArgument(Array.isArray(seed), "seed must be an array of numbers", "seed", seed);
    const allowedLengths = [64, 72, 96];
    assertArgument(allowedLengths.includes(seed.length), "seed must be 64, 72, or 96 bytes", "seed", seed.length);
    const qcWallet = qcsdk.openWalletFromSeed(seed);
    if (!qcWallet || typeof qcWallet === "number") {
      throw makeError("openWalletFromSeed failed", "UNKNOWN_ERROR", { result: qcWallet });
    }
    return Wallet._fromQcWallet(qcWallet, provider || null);
  }

  /**
   * Creates a wallet from an encrypted JSON string.
   * @param {string} json
   * @param {string} password
   * @param {import("../providers/provider").AbstractProvider=} provider
   * @returns {Wallet}
   */
  static fromEncryptedJsonSync(json, password, provider) {
    _requireInitialized();
    const qcWallet = qcsdk.deserializeEncryptedWallet(json, password);
    if (!qcWallet) throw makeError("deserializeEncryptedWallet failed", "UNKNOWN_ERROR", {});
    return Wallet._fromQcWallet(qcWallet, provider || null);
  }

  /**
   * Creates a wallet from a seed phrase (32, 36, or 48 words).
   * @param {string|string[]} phrase
   * @param {import("../providers/provider").AbstractProvider=} provider
   * @returns {Wallet}
   */
  static fromPhrase(phrase, provider) {
    _requireInitialized();
    let words = phrase;
    if (typeof phrase === "string") {
      words = phrase
        .split(/[,\s]+/g)
        .map((w) => w.trim())
        .filter(Boolean);
    }
    assertArgument(Array.isArray(words), "phrase must be a string or string[]", "phrase", phrase);
    const allowedLengths = [32, 36, 48];
    assertArgument(
      allowedLengths.includes(words.length),
      "seed phrase must contain 32, 36, or 48 words",
      "phrase",
      words.length,
    );
    const qcWallet = qcsdk.openWalletFromSeedWords(words);
    if (!qcWallet) throw makeError("openWalletFromSeedWords failed", "UNKNOWN_ERROR", {});
    return Wallet._fromQcWallet(qcWallet, provider || null);
  }

  /**
   * Creates a wallet from raw private and public key bytes.
   * @param {Uint8Array|string} privateKey  Private key bytes or hex string
   * @param {Uint8Array|string} publicKey   Public key bytes or hex string
   * @param {import("../providers/provider").AbstractProvider=} provider
   * @returns {Wallet}
   */
  static fromKeys(privateKey, publicKey, provider) {
    _requireInitialized();
    const privBytes = typeof privateKey === "string" ? hexToBytes(privateKey) : arrayify(privateKey);
    const pubBytes = typeof publicKey === "string" ? hexToBytes(publicKey) : arrayify(publicKey);
    assertSecretArgument(privBytes.length > 0, "privateKey must not be empty", "privateKey");
    assertSecretArgument(pubBytes.length > 0, "publicKey must not be empty", "publicKey");

    const privArr = _bytesToNumberArray(privBytes);
    const pubArr = _bytesToNumberArray(pubBytes);
    const addr = qcsdk.addressFromPublicKey(pubArr);
    if (typeof addr !== "string") throw makeError("addressFromPublicKey failed", "UNKNOWN_ERROR", {});

    const qcWallet = new qcsdk.Wallet(addr, privArr, pubArr);
    // Key-pair verification now happens centrally in the Wallet constructor
    // (reached via _fromQcWallet -> new Wallet). No redundant verify here.
    return Wallet._fromQcWallet(qcWallet, provider || null);
  }

  /**
   * Internal helper: build a Wallet from a quantum-coin-js-sdk Wallet object.
   * @param {any} qcWallet
   * @param {import("../providers/provider").AbstractProvider|null} provider
   * @returns {Wallet}
   */
  static _fromQcWallet(qcWallet, provider) {
    const privSrc = qcWallet.privateKey;
    const pubSrc = qcWallet.publicKey;

    if (!privSrc || (privSrc instanceof Uint8Array && privSrc.length === 0) || (Array.isArray(privSrc) && privSrc.length === 0)) {
      throw makeError("qcWallet.privateKey is empty or missing", "UNKNOWN_ERROR", {});
    }
    if (!pubSrc || (pubSrc instanceof Uint8Array && pubSrc.length === 0) || (Array.isArray(pubSrc) && pubSrc.length === 0)) {
      throw makeError("qcWallet.publicKey is empty or missing", "UNKNOWN_ERROR", {});
    }

    const privBytes =
      privSrc instanceof Uint8Array ? new Uint8Array(privSrc) : Uint8Array.from(Array.from(privSrc).map((n) => (Number(n) & 0xff)));
    const pubBytes =
      pubSrc instanceof Uint8Array ? new Uint8Array(pubSrc) : Uint8Array.from(Array.from(pubSrc).map((n) => (Number(n) & 0xff)));
    const key = new SigningKey(privBytes, pubBytes);

    const w = new Wallet(key, provider || null);
    // Ensure we keep the exact underlying qcWallet for operations like encrypt/signRawTransaction.
    w._qcWallet = qcWallet;
    if (typeof qcWallet.address === "string") {
      w.address = normalizeHex(qcWallet.address);
    }
    if (qcWallet.preExpansionSeed != null) {
      const seedSrc = qcWallet.preExpansionSeed;
      const seedBytes =
        seedSrc instanceof Uint8Array ? seedSrc : Uint8Array.from(Array.from(seedSrc).map((n) => (Number(n) & 0xff)));
      w._seed = bytesToHex(seedBytes);
    }
    return w;
  }
}

/**
 * NonceManager wrapper.
 */
class NonceManager extends AbstractSigner {
  /**
   * @param {AbstractSigner} signer
   */
  constructor(signer) {
    super(signer.provider || null);
    this.signer = signer;
    this._nonce = null;
  }

  async getAddress() {
    return this.signer.getAddress();
  }

  async getTransactionCount(blockTag) {
    if (this._nonce != null) return this._nonce;
    if (!this.provider) throw makeError("missing provider", "UNKNOWN_ERROR", { operation: "getTransactionCount" });
    const address = await this.getAddress();
    this._nonce = await this.provider.getTransactionCount(address, blockTag);
    return this._nonce;
  }

  async sendTransaction(tx) {
    const nonce = await this.getTransactionCount("latest");
    const result = await this.signer.sendTransaction({ ...tx, nonce });
    this._nonce = nonce + 1;
    return result;
  }

  reset() {
    this._nonce = null;
  }

  increment() {
    if (this._nonce == null) this._nonce = 0;
    this._nonce++;
  }
}

/**
 * JsonRpcSigner placeholder (ethers-like).
 * This SDK encourages using Wallet directly for signing.
 */
class JsonRpcSigner extends AbstractSigner {
  constructor(provider, address) {
    super(provider);
    this._address = address;
  }
  async getAddress() {
    return this._address;
  }
}

/**
 * VoidSigner (cannot sign, only provides address).
 */
class VoidSigner extends AbstractSigner {
  constructor(address, provider) {
    super(provider || null);
    this._address = getAddress(address);
  }
  async getAddress() {
    return this._address;
  }
}

/**
 * Recover the signer's 32-byte address from an EIP-191 message signature.
 *
 * QuantumCoin has no ECDSA `ecrecover`: signatures are opaque post-quantum blobs
 * that embed the signer's public key. This function re-derives the EIP-191
 * digest with {@link hashMessage}, extracts and cryptographically verifies the
 * embedded public key against that digest via
 * `quantum-coin-js-sdk.publicKeyFromSignature`, and returns the corresponding
 * 32-byte address. If the signature does not verify there is nothing to recover,
 * so the function throws.
 *
 * Synchronous, matching ethers' `verifyMessage` (there is no async variant).
 *
 * @param {string|Uint8Array} message The original message (strings are UTF-8 encoded).
 * @param {string|Uint8Array} signature The signature produced by `signMessage`.
 * @returns {string} 0x-prefixed 32-byte signer address.
 * @throws {TypeError} INVALID_ARGUMENT if the signature is malformed or does not verify.
 */
function verifyMessage(message, signature) {
  _requireInitialized();
  const digestHex = hashMessage(message);
  const digestArr = _bytesToNumberArray(hexToBytes(digestHex));
  const sigArr = _bytesToNumberArray(arrayify(signature));
  const pubHex = qcsdk.publicKeyFromSignature(digestArr, sigArr);
  if (typeof pubHex !== "string") {
    throw makeError("verifyMessage failed: signature did not verify", "INVALID_ARGUMENT", {
      argument: "signature",
      value: "[signature]",
    });
  }
  return computeAddress(pubHex);
}

module.exports = {
  SigningKey,
  AbstractSigner,
  BaseWallet,
  Wallet,
  NonceManager,
  JsonRpcSigner,
  VoidSigner,
  verifyMessage,
};

