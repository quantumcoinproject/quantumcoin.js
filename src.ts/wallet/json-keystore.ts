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

//import { CTR } from "aes-js";

//import { getAddress } from "../address/index.js";
//randomBytes, scrypt, scryptSync, uuidV4
//import { keccak256  } from "../crypto/index.js";
//import { computeAddress } from "../transaction/index.js";
//concat, assert, assertArgument,
import {
    getBytes, hexlify, toUtf8String
} from "../utils/index.js";

import {SigningKey} from "../crypto/signing-key.js"

//zpad
//import { spelunk } from "./utils.js";

//import type { ProgressCallback } from "../crypto/index.js";
//import {Wallet} from "quantum-coin-js-sdk";
//import type { BytesLike } from "../utils/index.js";
import qcsdk = require('quantum-coin-js-sdk');

//import { version } from "../_version.js";


//const defaultPath = "m/44'/60'/0'/0/0";

/**
 *  The contents of a JSON Keystore Wallet.
 */
export type KeystoreAccount = {
    address: string;
    privateKey: string;
};

/**
 *  Returns true if %%json%% is a valid JSON Keystore Wallet.
 */
export function isKeystoreJson(json: string): boolean {
    try {
        const data = JSON.parse(json);
        const version = ((data.version != null) ? parseInt(data.version): 0);
        if (version === 3) { return true; }
    } catch (error) { }
    return false;
}

/**
 *  Resolves to the decrypted JSON Keystore Wallet %%json%% using the
 *  %%password%%.
 *
 *  If provided, %%progress%% will be called periodically during the
 *  decrpytion to provide feedback, and if the function returns
 *  ``false`` will halt decryption.
 */
export function decryptKeystoreJsonSync(json: string, _password: string | Uint8Array): KeystoreAccount {
    let pass: string;
    if (typeof _password === 'string') {
        pass = _password;
    } else {
        pass =  toUtf8String(_password);
    }

    let wal = qcsdk.deserializeEncryptedWallet(json, pass);
    let privKey: any = wal.privateKey;

    let ks: KeystoreAccount = {
        address: wal.address,
        privateKey: hexlify(privKey)
    };

    return ks;
}

/**
 *  Resolved to the JSON Keystore Wallet for %%account%% encrypted
 *  with %%password%%.
 *
 *  The %%options%% can be used to tune the password-based key
 *  derivation function parameters, explicitly set the random values
 *  used.
 */
export function encryptKeystoreJsonSync(account: KeystoreAccount, password: Uint8Array | string): string {
    const signingKey: SigningKey = new SigningKey(account.privateKey);
    const privateKey: any = getBytes(signingKey.privateKey);
    const publicKey: any = getBytes(signingKey.publicKey);
    const wal = new qcsdk.Wallet(account.address, privateKey, publicKey);

    if (typeof password === 'string') {
        return qcsdk.serializeEncryptedWallet(wal, password);
    } else {
        let passPhrase = toUtf8String(password);
        return qcsdk.serializeEncryptedWallet(wal, passPhrase);
    }
}

