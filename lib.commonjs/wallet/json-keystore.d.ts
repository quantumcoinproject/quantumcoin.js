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
export declare function isKeystoreJson(json: string): boolean;
/**
 *  Resolves to the decrypted JSON Keystore Wallet %%json%% using the
 *  %%password%%.
 *
 *  If provided, %%progress%% will be called periodically during the
 *  decrpytion to provide feedback, and if the function returns
 *  ``false`` will halt decryption.
 */
export declare function decryptKeystoreJsonSync(json: string, _password: string | Uint8Array): KeystoreAccount;
/**
 *  Resolved to the JSON Keystore Wallet for %%account%% encrypted
 *  with %%password%%.
 *
 *  The %%options%% can be used to tune the password-based key
 *  derivation function parameters, explicitly set the random values
 *  used.
 */
export declare function encryptKeystoreJsonSync(account: KeystoreAccount, password: Uint8Array | string): string;
//# sourceMappingURL=json-keystore.d.ts.map