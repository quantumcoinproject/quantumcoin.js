//import { getAddress } from "../address/index.js";
// keccak256,
import {SigningKey } from "../crypto/index.js";

import type { SignatureLike } from "../crypto/index.js";
import {BytesLike, getBytes} from "../utils/index.js";
import {addressFromPublicKey} from "quantum-coin-js-sdk";

/**
 *  Returns the address for the %%key%%.
 *
 *  The key may be any standard form of public key or a private key.
 */
export function computeAddress(key: string | SigningKey): string {
    let pubkey: string;
    if (typeof(key) === "string") {
        if (key.startsWith("0x")) {
            pubkey = SigningKey.computePublicKey(key);
        } else {
            pubkey = SigningKey.computePublicKey("0x" + key);
        }
    } else {
        pubkey = key.publicKey;
    }
    let pubKeyBytes: any = getBytes(pubkey);
    return addressFromPublicKey(pubKeyBytes);
}

/**
 *  Returns the recovered address for the private key that was
 *  used to sign %%digest%% that resulted in %%signature%%.
 */
export function recoverAddress(digest: BytesLike, signature: SignatureLike): string {
    return computeAddress(SigningKey.recoverPublicKey(digest, signature));
}
