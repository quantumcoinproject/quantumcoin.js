declare const _exports: {
    verifyMessage(message: string | Uint8Array, signature: string | Uint8Array): string;
    SigningKey: typeof import("./wallet").SigningKey;
    AbstractSigner: typeof import("./wallet").AbstractSigner;
    BaseWallet: typeof import("./wallet").BaseWallet;
    Wallet: typeof import("./wallet").Wallet;
    NonceManager: typeof import("./wallet").NonceManager;
    JsonRpcSigner: typeof import("./wallet").JsonRpcSigner;
    VoidSigner: typeof import("./wallet").VoidSigner;
};
export = _exports;
