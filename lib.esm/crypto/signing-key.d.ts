/**
 *  Add details about signing here.
 *
 *  @_subsection: api/crypto:Signing  [about-signing]
 */
import { Signature } from "./signature.js";
import type { BytesLike } from "../utils/index.js";
import type { SignatureLike } from "./index.js";
/**
 *  A **SigningKey** provides high-level access to cryptography operations and key management.
 */
export declare class SigningKey {
    #private;
    /**
     *  Creates a new **SigningKey** for %%privateKey%%.
     */
    constructor(privateKey: BytesLike);
    /**
     *  The private key.
     */
    get privateKey(): string;
    /**
     *  The public key.
     *
     */
    get publicKey(): string;
    /**
     *  Return the signature of the signed %%digest%%.
     */
    sign(digest: BytesLike): Signature;
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
    static computePublicKey(key: BytesLike): string;
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
    static recoverPublicKey(digest: BytesLike, signature: SignatureLike): string;
}
//# sourceMappingURL=signing-key.d.ts.map