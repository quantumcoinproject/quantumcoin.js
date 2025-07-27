"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = void 0;
const index_js_1 = require("../crypto/index.js");
const index_js_2 = require("../utils/index.js");
const base_wallet_js_1 = require("./base-wallet.js");
//import { decryptCrowdsaleJson, isCrowdsaleJson  } from "./json-crowdsale.js";
const json_keystore_js_1 = require("./json-keystore.js");
//import { Mnemonic } from "./mnemonic.js";
const qcsdk = require("quantum-coin-js-sdk");
//import {newWallet} from "quantum-coin-js-sdk";
/**
 *  A **Wallet** manages a single private key which is used to sign
 *  transactions, messages and other common payloads.
 *
 *  This class is generally the main entry point for developers
 *  that wish to use a private key directly, as it can create
 *  instances from a large variety of common sources, including
 *  raw private key, [[link-bip-39]] mnemonics and encrypte JSON
 *  wallets.
 */
class Wallet extends base_wallet_js_1.BaseWallet {
    /**
     *  Create a new wallet for the private %%key%%, optionally connected
     *  to %%provider%%.
     */
    constructor(key, provider) {
        if (typeof (key) === "string" && !key.startsWith("0x")) {
            key = "0x" + key;
        }
        let signingKey = (typeof (key) === "string") ? new index_js_1.SigningKey(key) : key;
        super(signingKey, provider);
    }
    connect(provider) {
        return new Wallet(this.signingKey, provider);
    }
    /**
     *  Resolves to a [JSON Keystore Wallet](json-wallets) encrypted with
     *  %%password%%.
     *
     *  If %%progressCallback%% is specified, it will receive periodic
     *  updates as the encryption process progreses.
     */
    async encrypt(password) {
        const account = { address: this.address, privateKey: this.privateKey };
        return (0, json_keystore_js_1.encryptKeystoreJsonSync)(account, password);
    }
    /**
     *  Returns a [JSON Keystore Wallet](json-wallets) encryped with
     *  %%password%%.
     *
     *  It is preferred to use the [async version](encrypt) instead,
     *  which allows a [[ProgressCallback]] to keep the user informed.
     *
     *  This method will block the event loop (freezing all UI) until
     *  it is complete, which may be a non-trivial duration.
     */
    encryptSync(password) {
        const account = { address: this.address, privateKey: this.privateKey };
        return (0, json_keystore_js_1.encryptKeystoreJsonSync)(account, password);
    }
    static #fromAccount(account) {
        (0, index_js_2.assertArgument)(account, "invalid JSON wallet", "json", "[ REDACTED ]");
        const wallet = new Wallet(account.privateKey);
        (0, index_js_2.assertArgument)(wallet.address === account.address, "address/privateKey mismatch", "json", "[ REDACTED ]");
        return wallet;
    }
    /**
     *  Creates (asynchronously) a **Wallet** by decrypting the %%json%%
     *  with %%password%%.
     */
    static async fromEncryptedJson(json, password) {
        let account = null;
        if ((0, json_keystore_js_1.isKeystoreJson)(json)) {
            account = (0, json_keystore_js_1.decryptKeystoreJsonSync)(json, password);
        }
        return Wallet.#fromAccount(account);
    }
    /**
     *  Creates a **Wallet** by decrypting the %%json%% with %%password%%.
     *
     *  The [[fromEncryptedJson]] method is preferred, as this method
     *  will lock up and freeze the UI during decryption, which may take
     *  some time.
     */
    static fromEncryptedJsonSync(json, password) {
        let account = null;
        if ((0, json_keystore_js_1.isKeystoreJson)(json)) {
            account = (0, json_keystore_js_1.decryptKeystoreJsonSync)(json, password);
        }
        else {
            (0, index_js_2.assertArgument)(false, "invalid JSON wallet", "json", "[ REDACTED ]");
        }
        return Wallet.#fromAccount(account);
    }
    /**
     *  Creates a new random [[Wallet]] using the available
     *  [cryptographic random source](randomBytes).
     *
     *  If there is no crytographic random source, this will throw.
     */
    static createRandom(provider) {
        let wal = qcsdk.newWallet();
        let privKey = wal.privateKey;
        return new Wallet((0, index_js_2.hexlify)(privKey));
    }
}
exports.Wallet = Wallet;
//# sourceMappingURL=wallet.js.map