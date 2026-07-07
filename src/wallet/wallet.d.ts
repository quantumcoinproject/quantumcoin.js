/**
 * SigningKey wrapper (PQC private/public key bytes).
 */
export class SigningKey {
    /**
     * @param {Uint8Array} privateKeyBytes
     * @param {Uint8Array} publicKeyBytes
     */
    constructor(privateKeyBytes: Uint8Array, publicKeyBytes: Uint8Array);
    privateKeyBytes: Uint8Array<ArrayBuffer>;
    publicKeyBytes: Uint8Array<ArrayBuffer>;
    toJSON(): {};
}
/**
 * AbstractSigner base (minimal).
 */
export class AbstractSigner {
    /**
     * @param {import("../providers/provider").AbstractProvider|null} provider
     */
    constructor(provider: import("../providers/provider").AbstractProvider | null);
    provider: import("../providers/provider").AbstractProvider | null;
    getAddress(): Promise<void>;
}
/**
 * BaseWallet - core signing implementation.
 */
export class BaseWallet extends AbstractSigner {
    /**
     * @param {SigningKey} signingKey
     * @param {import("../providers/provider").AbstractProvider|null=} provider
     * @param {{ address: string }=} precomputed
     * @param {any=} qcWallet Internal quantum-coin-js-sdk Wallet (optional)
     */
    constructor(signingKey: SigningKey, provider?: (import("../providers/provider").AbstractProvider | null) | undefined, precomputed?: {
        address: string;
    } | undefined, qcWallet?: any | undefined);
    signingKey: SigningKey;
    _qcWallet: any;
    /** @type {string} */
    address: string;
    readonly publicKey: string;
    readonly seed: string | null;
    toJSON(): {
        address: string;
    };
    getAddress(): Promise<string>;
    /**
     * Sign a transaction using quantum-coin-js-sdk signRawTransaction().
     * @param {import("../providers/provider").TransactionRequest} tx
     * @returns {Promise<string>}
     */
    signTransaction(tx: import("../providers/provider").TransactionRequest): Promise<string>;
    /**
     * Sign an arbitrary message (EIP-191 personal-message scheme), synchronously.
     * Returns an opaque post-quantum signature blob (0x hex) that embeds the
     * signer's public key. Optional signingContext: when omitted/null the compact
     * context is derived from the key type (0 for keyType 3, 1 for keyType 5);
     * pass 2 for the full-signature scheme on a keyType 3 wallet.
     * @param {string|Uint8Array} message
     * @param {number|null=} signingContext
     * @returns {string}
     */
    signMessageSync(message: string | Uint8Array, signingContext?: (number | null) | undefined): string;
    /**
     * Sign an arbitrary message (EIP-191). Async wrapper over signMessageSync.
     * @param {string|Uint8Array} message
     * @param {number|null=} signingContext
     * @returns {Promise<string>}
     */
    signMessage(message: string | Uint8Array, signingContext?: (number | null) | undefined): Promise<string>;
    /**
     * Internal: sign a transaction and return both the raw serialized transaction
     * and the signer-computed transaction hash. The hash is later used to
     * verify that an untrusted RPC node broadcast exactly the transaction we
     * signed rather than substituting a different one.
     * @param {import("../providers/provider").TransactionRequest} tx
     * @returns {Promise<{ raw: string, hash: string|null }>}
     */
    _signDetailed(tx: import("../providers/provider").TransactionRequest): Promise<{
        raw: string;
        hash: string | null;
    }>;
    /**
     * Signs and sends a transaction.
     * @param {import("../providers/provider").TransactionRequest} tx
     * @returns {Promise<import("../providers/provider").TransactionResponse>}
     */
    sendTransaction(tx: import("../providers/provider").TransactionRequest): Promise<import("../providers/provider").TransactionResponse>;
}
/**
 * Wallet - convenience methods around BaseWallet.
 */
export class Wallet extends BaseWallet {
    /**
     * Encrypts raw seed bytes into a wallet JSON string (version 5 pre-expansion format).
     * The resulting JSON can be opened with `Wallet.fromEncryptedJsonSync()` or
     * Desktop/Mobile/Web/CLI wallet applications.
     * @param {number[]|Uint8Array} seed  Raw seed bytes: 64 (keyType 3), 72 (keyType 5), or 96 (legacy)
     * @param {string|Uint8Array} password  Passphrase (at least 12 characters)
     * @returns {string}
     */
    static encryptSeedSync(seed: number[] | Uint8Array, password: string | Uint8Array): string;
    /**
     * Creates a new random wallet.
     * @param {import("../providers/provider").AbstractProvider=} provider
     * @param {number|null=} keyType  Optional key type: null (default=3), 3, or 5
     * @returns {Wallet}
     */
    static createRandom(provider?: import("../providers/provider").AbstractProvider | undefined, keyType?: (number | null) | undefined): Wallet;
    /**
     * Creates a wallet from raw seed bytes.
     * @param {number[]} seed  Raw seed bytes: 64 (keyType 3), 72 (keyType 5), or 96 (legacy)
     * @param {import("../providers/provider").AbstractProvider=} provider
     * @returns {Wallet}
     */
    static fromSeed(seed: number[], provider?: import("../providers/provider").AbstractProvider | undefined): Wallet;
    /**
     * Creates a wallet from an encrypted JSON string.
     * @param {string} json
     * @param {string} password
     * @param {import("../providers/provider").AbstractProvider=} provider
     * @returns {Wallet}
     */
    static fromEncryptedJsonSync(json: string, password: string, provider?: import("../providers/provider").AbstractProvider | undefined): Wallet;
    /**
     * Creates a wallet from a seed phrase (32, 36, or 48 words).
     * @param {string|string[]} phrase
     * @param {import("../providers/provider").AbstractProvider=} provider
     * @returns {Wallet}
     */
    static fromPhrase(phrase: string | string[], provider?: import("../providers/provider").AbstractProvider | undefined): Wallet;
    /**
     * Creates a wallet from raw private and public key bytes.
     * @param {Uint8Array|string} privateKey  Private key bytes or hex string
     * @param {Uint8Array|string} publicKey   Public key bytes or hex string
     * @param {import("../providers/provider").AbstractProvider=} provider
     * @returns {Wallet}
     */
    static fromKeys(privateKey: Uint8Array | string, publicKey: Uint8Array | string, provider?: import("../providers/provider").AbstractProvider | undefined): Wallet;
    /**
     * Internal helper: build a Wallet from a quantum-coin-js-sdk Wallet object.
     * @param {any} qcWallet
     * @param {import("../providers/provider").AbstractProvider|null} provider
     * @returns {Wallet}
     */
    static _fromQcWallet(qcWallet: any, provider: import("../providers/provider").AbstractProvider | null): Wallet;
    /**
     * @param {string|Uint8Array|SigningKey} key
     * @param {import("../providers/provider").AbstractProvider=} provider
     */
    constructor(key: string | Uint8Array | SigningKey, provider?: import("../providers/provider").AbstractProvider | undefined);
    /**
     * Returns wallet address (sync).
     * @returns {string}
     */
    getAddress(): string;
    /**
     * Returns wallet balance.
     * @param {string=} blockTag
     * @returns {Promise<bigint>}
     */
    getBalance(blockTag?: string | undefined): Promise<bigint>;
    /**
     * Returns wallet nonce.
     * @param {string=} blockTag
     * @returns {Promise<number>}
     */
    getTransactionCount(blockTag?: string | undefined): Promise<number>;
    /**
     * Encrypts and serializes this wallet to JSON.
     * @param {string|Uint8Array} password
     * @returns {string}
     */
    encryptSync(password: string | Uint8Array): string;
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
    getPhrase(): string[] | null;
    /**
     * Returns the recommended signing context for this wallet.
     * Setting fullSign to true may incur additional gas cost.
     * @param {boolean|null=} fullSign  Defaults to false when null or omitted.
     * @returns {number}
     */
    getSigningContext(fullSign?: (boolean | null) | undefined): number;
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
    getKeyType(): number;
    /**
     * Returns a new wallet connected to a provider.
     * @param {import("../providers/provider").AbstractProvider} provider
     * @returns {Wallet}
     */
    connect(provider: import("../providers/provider").AbstractProvider): Wallet;
}
/**
 * NonceManager wrapper.
 */
export class NonceManager extends AbstractSigner {
    /**
     * @param {AbstractSigner} signer
     */
    constructor(signer: AbstractSigner);
    signer: AbstractSigner;
    _nonce: any;
    getTransactionCount(blockTag: any): any;
    sendTransaction(tx: any): Promise<any>;
    reset(): void;
    increment(): void;
}
/**
 * JsonRpcSigner placeholder (ethers-like).
 * This SDK encourages using Wallet directly for signing.
 */
export class JsonRpcSigner extends AbstractSigner {
    constructor(provider: any, address: any);
    _address: any;
    getAddress(): Promise<any>;
}
/**
 * VoidSigner (cannot sign, only provides address).
 */
export class VoidSigner extends AbstractSigner {
    constructor(address: any, provider: any);
    _address: string;
    getAddress(): Promise<string>;
}
/**
 * Recover the signer's 32-byte address from an EIP-191 message signature.
 *
 * QuantumCoin has no ECDSA ecrecover; the post-quantum signature embeds the
 * public key, which is extracted and verified against the message digest before
 * the address is returned. Throws INVALID_ARGUMENT if the signature is malformed
 * or does not verify. Synchronous, matching ethers' verifyMessage.
 *
 * @param {string|Uint8Array} message The original message (strings are UTF-8 encoded).
 * @param {string|Uint8Array} signature The signature produced by signMessage.
 * @returns {string} 0x-prefixed 32-byte signer address.
 */
export function verifyMessage(message: string | Uint8Array, signature: string | Uint8Array): string;
