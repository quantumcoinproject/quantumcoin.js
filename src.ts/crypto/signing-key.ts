/**
 *  Add details about signing here.
 *
 *  @_subsection: api/crypto:Signing  [about-signing]
 */

import {combinePublicKeySignature, publicKeyFromPrivateKey, publicKeyFromSignature} from "quantum-coin-js-sdk";
import {cryptoSign} from "quantum-coin-pqc-js-sdk";

import {
    getBytes,
    dataLength, getBytesCopy, hexlify,
    assertArgument,
} from "../utils/index.js";

import { Signature } from "./signature.js";

import type { BytesLike } from "../utils/index.js";

import type { SignatureLike } from "./index.js";

const CRYPTO_MESSAGE_LENGTH = 32;
const CRYPTO_SECRETKEY_BYTES = 64 + 2560 + 1312 + 128;
const CRYPTO_PUBLICKEY_BYTES = 32 + 1312 + 64;

/**
 *  A **SigningKey** provides high-level access to cryptography operations and key management.
 */
export class SigningKey {
    #privateKey: string;

    /**
     *  Creates a new **SigningKey** for %%privateKey%%.
     */
    constructor(privateKey: BytesLike) {
        assertArgument(dataLength(privateKey) === CRYPTO_SECRETKEY_BYTES, "invalid private key", "privateKey", "[REDACTED]");
        this.#privateKey = hexlify(privateKey);
    }

    /**
     *  The private key.
     */
    get privateKey(): string { return this.#privateKey; }

    /**
     *  The public key.
     *
     */
    get publicKey(): string { return SigningKey.computePublicKey(this.#privateKey); }

    /**
     *  Return the signature of the signed %%digest%%.
     */
    sign(digest: BytesLike): Signature {
        assertArgument(dataLength(digest) === CRYPTO_MESSAGE_LENGTH, "invalid digest length", "digest", digest);

        const sig: any = cryptoSign(getBytesCopy(digest), getBytesCopy(this.#privateKey));
        const pubBytes: any = getBytes(this.publicKey);
        let combinedSig = combinePublicKeySignature(pubBytes, sig);
        combinedSig = "0x" + combinedSig;

        return Signature.from({
            r: this.publicKey,
            s: combinedSig,
            v: 0x1
        });
    }

    /**
     *  Compute the public key for a private %%key%%. If a publicKey is passed, it is returned as is. for backward compatibility.
     *
     *
     *  @example:
     *    sign = new SigningKey(id("some-secret"));
     *
     *    // Compute the public key for a private key
     *    SigningKey.computePublicKey(sign.privateKey)
     *    //_result:
     */
    static computePublicKey(key: BytesLike): string {
        let keyBytes: any = getBytes(key, "key");
        let pubKey: any;

        if (keyBytes.length == CRYPTO_SECRETKEY_BYTES) {
            pubKey = publicKeyFromPrivateKey(keyBytes);
            assertArgument(pubKey !== null && pubKey !== undefined, "invalid key", "key", "[REDACTED]");
            pubKey = '0x' + pubKey;
        } else if(keyBytes.length == CRYPTO_PUBLICKEY_BYTES) {
            pubKey = keyBytes;
        }

        assertArgument(pubKey !== null && pubKey !== undefined, "invalid key", "key", "[REDACTED]");
        return pubKey;
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
    static recoverPublicKey(digest: BytesLike, signature: SignatureLike): string {
        assertArgument(dataLength(digest) === CRYPTO_MESSAGE_LENGTH, "invalid digest length", "digest", digest);

        const sig = Signature.from(signature);
        let sigBytes: any = getBytes(sig.s);
        let digestBytes: any = digest;

        let publicKey = publicKeyFromSignature(digestBytes, sigBytes);

        return publicKey;
    }
}

