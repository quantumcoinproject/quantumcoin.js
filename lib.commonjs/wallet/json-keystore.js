"use strict";
/**
 *  The JSON Wallet formats allow a simple way to store the private
 *  keys needed in Ethereum along with related information and allows
 *  for extensible forms of encryption.
 *
 *  These utilities facilitate decrypting and encrypting the most common
 *  JSON Wallet formats.
 *
 *  @_subsection: api/wallet:JSON Wallets  [json-wallets]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptKeystoreJsonSync = exports.decryptKeystoreJsonSync = exports.isKeystoreJson = void 0;
//import { CTR } from "aes-js";
//import { getAddress } from "../address/index.js";
//randomBytes, scrypt, scryptSync, uuidV4
//import { keccak256  } from "../crypto/index.js";
//import { computeAddress } from "../transaction/index.js";
//concat, assert, assertArgument,
const index_js_1 = require("../utils/index.js");
const signing_key_js_1 = require("../crypto/signing-key.js");
//zpad
//import { spelunk } from "./utils.js";
//import type { ProgressCallback } from "../crypto/index.js";
//import {Wallet} from "quantum-coin-js-sdk";
//import type { BytesLike } from "../utils/index.js";
const quantum_coin_js_sdk_1 = require("quantum-coin-js-sdk");
/**
 *  Returns true if %%json%% is a valid JSON Keystore Wallet.
 */
function isKeystoreJson(json) {
    try {
        const data = JSON.parse(json);
        const version = ((data.version != null) ? parseInt(data.version) : 0);
        if (version === 3) {
            return true;
        }
    }
    catch (error) { }
    return false;
}
exports.isKeystoreJson = isKeystoreJson;
/**
 *  Resolves to the decrypted JSON Keystore Wallet %%json%% using the
 *  %%password%%.
 *
 *  If provided, %%progress%% will be called periodically during the
 *  decrpytion to provide feedback, and if the function returns
 *  ``false`` will halt decryption.
 */
function decryptKeystoreJsonSync(json, _password) {
    let pass;
    if (typeof _password === 'string') {
        pass = _password;
    }
    else {
        pass = (0, index_js_1.toUtf8String)(_password);
    }
    let wal = (0, quantum_coin_js_sdk_1.deserializeEncryptedWallet)(json, pass);
    let privKey = wal.privateKey;
    let ks = {
        address: wal.address,
        privateKey: (0, index_js_1.hexlify)(privKey)
    };
    return ks;
}
exports.decryptKeystoreJsonSync = decryptKeystoreJsonSync;
/**
 *  Resolved to the JSON Keystore Wallet for %%account%% encrypted
 *  with %%password%%.
 *
 *  The %%options%% can be used to tune the password-based key
 *  derivation function parameters, explicitly set the random values
 *  used.
 */
function encryptKeystoreJsonSync(account, password) {
    const signingKey = new signing_key_js_1.SigningKey(account.privateKey);
    const privateKey = (0, index_js_1.getBytes)(signingKey.privateKey);
    const publicKey = (0, index_js_1.getBytes)(signingKey.publicKey);
    const wal = new quantum_coin_js_sdk_1.Wallet(account.address, privateKey, publicKey);
    if (typeof password === 'string') {
        return (0, quantum_coin_js_sdk_1.serializeEncryptedWallet)(wal, password);
    }
    else {
        let passPhrase = (0, index_js_1.toUtf8String)(password);
        return (0, quantum_coin_js_sdk_1.serializeEncryptedWallet)(wal, passPhrase);
    }
}
exports.encryptKeystoreJsonSync = encryptKeystoreJsonSync;
//# sourceMappingURL=json-keystore.js.map