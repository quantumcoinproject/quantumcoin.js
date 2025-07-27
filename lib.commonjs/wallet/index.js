"use strict";
/**
 *  When interacting with Ethereum, it is necessary to use a private
 *  key authenticate actions by signing a payload.
 *
 *  Wallets are the simplest way to expose the concept of an
 *  //Externally Owner Account// (EOA) as it wraps a private key
 *  and supports high-level methods to sign common types of interaction
 *  and send transactions.
 *
 *  The class most developers will want to use is [[Wallet]], which
 *  can load a private key directly or from any common wallet format.
 *
 *  The [[HDNodeWallet]] can be used when it is necessary to access
 *  low-level details of how an HD wallets are derived, exported
 *  or imported.
 *
 *  @_section: api/wallet:Wallets  [about-wallets]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = exports.Mnemonic = exports.encryptKeystoreJsonSync = exports.decryptKeystoreJsonSync = exports.isKeystoreJson = exports.BaseWallet = void 0;
var base_wallet_js_1 = require("./base-wallet.js");
Object.defineProperty(exports, "BaseWallet", { enumerable: true, get: function () { return base_wallet_js_1.BaseWallet; } });
var json_keystore_js_1 = require("./json-keystore.js");
Object.defineProperty(exports, "isKeystoreJson", { enumerable: true, get: function () { return json_keystore_js_1.isKeystoreJson; } });
Object.defineProperty(exports, "decryptKeystoreJsonSync", { enumerable: true, get: function () { return json_keystore_js_1.decryptKeystoreJsonSync; } });
Object.defineProperty(exports, "encryptKeystoreJsonSync", { enumerable: true, get: function () { return json_keystore_js_1.encryptKeystoreJsonSync; } });
var mnemonic_js_1 = require("./mnemonic.js");
Object.defineProperty(exports, "Mnemonic", { enumerable: true, get: function () { return mnemonic_js_1.Mnemonic; } });
var wallet_js_1 = require("./wallet.js");
Object.defineProperty(exports, "Wallet", { enumerable: true, get: function () { return wallet_js_1.Wallet; } });
//# sourceMappingURL=index.js.map