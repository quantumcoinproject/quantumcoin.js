//import { getAddress } from "../address/index.js";
// keccak256,
import { SigningKey } from "../crypto/index.js";
import { getBytes } from "../utils/index.js";
/**
 *  Returns the address for the %%key%%.
 *
 *  The key may be any standard form of public key or a private key.
 */
export function computeAddress(key) {
    let pubkey;
    if (typeof (key) === "string") {
        pubkey = SigningKey.computePublicKey(key);
    }
    else {
        pubkey = key.publicKey;
    }
    let pubKeyBytes = getBytes(pubkey);
    return qcsdk.addressFromPublicKey(pubKeyBytes);
}
/**
 *  Returns the recovered address for the private key that was
 *  used to sign %%digest%% that resulted in %%signature%%.
 */
export function recoverAddress(digest, signature) {
    return computeAddress(SigningKey.recoverPublicKey(digest, signature));
}
//# sourceMappingURL=address.js.map