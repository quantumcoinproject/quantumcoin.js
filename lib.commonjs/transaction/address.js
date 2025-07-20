"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverAddress = exports.computeAddress = void 0;
//import { getAddress } from "../address/index.js";
// keccak256, 
const index_js_1 = require("../crypto/index.js");
const index_js_2 = require("../utils/index.js");
const qcsdk = require("quantum-coin-js-sdk");
/**
 *  Returns the address for the %%key%%.
 *
 *  The key may be any standard form of public key or a private key.
 */
function computeAddress(key) {
    let pubkey;
    if (typeof (key) === "string") {
        pubkey = index_js_1.SigningKey.computePublicKey(key);
    }
    else {
        pubkey = key.publicKey;
    }
    let pubKeyBytes = (0, index_js_2.getBytes)(pubkey);
    return qcsdk.addressFromPublicKey(pubKeyBytes);
}
exports.computeAddress = computeAddress;
/**
 *  Returns the recovered address for the private key that was
 *  used to sign %%digest%% that resulted in %%signature%%.
 */
function recoverAddress(digest, signature) {
    return computeAddress(index_js_1.SigningKey.recoverPublicKey(digest, signature));
}
exports.recoverAddress = recoverAddress;
//# sourceMappingURL=address.js.map