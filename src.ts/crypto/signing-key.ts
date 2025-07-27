/**
 *  Add details about signing here.
 *
 *  @_subsection: api/crypto:Signing  [about-signing]
 */

import pqc = require('quantum-coin-pqc-js-sdk');
import qcsdk = require('quantum-coin-js-sdk');

import {
    getBytes,
    dataLength, getBytesCopy, hexlify,
    assertArgument
} from "../utils/index.js";

import { Signature } from "./signature.js";

import type { BytesLike } from "../utils/index.js";

import type { SignatureLike } from "./index.js";

const CRYPTO_MESSAGE_LENGTH = 32;
const CRYPTO_SECRETKEY_BYTES = 64 + 2560 + 1312 + 128;
//const CRYPTO_PUBLICKEY_BYTES = 32 + 1312 + 64;

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

        const sig: any = pqc.cryptoSign(getBytesCopy(digest), getBytesCopy(this.#privateKey));
        const pubBytes: any = getBytes(this.publicKey);
        const combinedSig = qcsdk.combinePublicKeySignature(pubBytes, sig);

        return Signature.from({
            r: this.publicKey,
            s: combinedSig,
            v: 0x1
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
    static computePublicKey(key: BytesLike): string {
        assertArgument(dataLength(key) === CRYPTO_SECRETKEY_BYTES, "invalid private key", "privateKey", "[REDACTED]");
        let priBytes: any = getBytes(key, "key");

        let pubKey = qcsdk.publicKeyFromPrivateKey(priBytes);

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

        let publicKey = qcsdk.publicKeyFromSignature(digestBytes, sigBytes);

        return publicKey;
    }
}

