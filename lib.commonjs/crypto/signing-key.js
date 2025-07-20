"use strict";
/**
 *  Add details about signing here.
 *
 *  @_subsection: api/crypto:Signing  [about-signing]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SigningKey = void 0;
const pqc = require("quantum-coin-pqc-js-sdk");
const qcsdk = require("quantum-coin-js-sdk");
const index_js_1 = require("../utils/index.js");
const signature_js_1 = require("./signature.js");
const CRYPTO_MESSAGE_LENGTH = 32;
const CRYPTO_SECRETKEY_BYTES = 64 + 2560 + 1312 + 128;
//const CRYPTO_PUBLICKEY_BYTES = 32 + 1312 + 64;
/**
 *  A **SigningKey** provides high-level access to cryptography operations and key management.
 */
class SigningKey {
    #privateKey;
    /**
     *  Creates a new **SigningKey** for %%privateKey%%.
     */
    constructor(privateKey) {
        (0, index_js_1.assertArgument)((0, index_js_1.dataLength)(privateKey) === CRYPTO_SECRETKEY_BYTES, "invalid private key", "privateKey", "[REDACTED]");
        this.#privateKey = (0, index_js_1.hexlify)(privateKey);
    }
    /**
     *  The private key.
     */
    get privateKey() { return this.#privateKey; }
    /**
     *  The public key.
     *
     */
    get publicKey() { return SigningKey.computePublicKey(this.#privateKey); }
    /**
     *  Return the signature of the signed %%digest%%.
     */
    sign(digest) {
        (0, index_js_1.assertArgument)((0, index_js_1.dataLength)(digest) === 32, "invalid digest length", "digest", digest);
        const sig = pqc.cryptoSign((0, index_js_1.getBytesCopy)(digest), (0, index_js_1.getBytesCopy)(this.#privateKey));
        return signature_js_1.Signature.from({
            r: this.publicKey,
            s: (0, index_js_1.hexlify)(sig),
            v: 0x1b
        });
    }
    /**
     *  Compute the public key for a private %%key%%.
     *
     *
     *  @example:
     *    sign = new SigningKey(id("some-secret"));
     *
     *    // Compute the public key for a private key
     *    SigningKey.computePublicKey(sign.privateKey)
     *    //_result:
     */
    static computePublicKey(key) {
        (0, index_js_1.assertArgument)((0, index_js_1.dataLength)(key) === CRYPTO_SECRETKEY_BYTES, "invalid private key", "privateKey", "[REDACTED]");
        let priBytes = (0, index_js_1.getBytes)(key, "key");
        let pubKey = qcsdk.publicKeyFromPrivateKey(priBytes);
        return (0, index_js_1.hexlify)(pubKey);
    }
    /**
     *  Returns the public key for the private key which produced the
     *  %%signature%% for the given %%digest%%.
     *
     *  @example:
     *    key = new SigningKey(id("some-secret"))
     *    digest = id("hello world")
     *    sig = key.sign(digest)
     *
     *    // Notice the signer public key...
     *    key.publicKey
     *    //_result:
     *
     *    // ...is equal to the recovered public key
     *    SigningKey.recoverPublicKey(digest, sig)
     *    //_result:
     *
     */
    static recoverPublicKey(digest, signature) {
        (0, index_js_1.assertArgument)((0, index_js_1.dataLength)(digest) === CRYPTO_MESSAGE_LENGTH, "invalid digest length", "digest", digest);
        const sig = signature_js_1.Signature.from(signature);
        let sigBytes = (0, index_js_1.getBytes)(sig.s);
        let digestBytes = digest;
        let publicKeyBytes = qcsdk.publicKeyFromSignature(digestBytes, sigBytes);
        return (0, index_js_1.hexlify)(publicKeyBytes);
    }
}
exports.SigningKey = SigningKey;
//# sourceMappingURL=signing-key.js.map