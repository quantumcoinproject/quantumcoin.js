export function cryptoRandom(size: any): Uint8Array;
export function cryptoNewSeed(): Uint8Array;
export function cryptoExpandSeed(seedArray: any): Uint8Array;
export function cryptoNewKeyPair(): KeyPair;
export function cryptoNewKeyPairFromSeed(expandedSeedArray: any): KeyPair;
export function cryptoSign(messageArray: any, privateKeyArray: any): Uint8Array;
export function cryptoVerify(messageArray: any, sigArray: any, publicKeyArray: any): boolean;
declare class KeyPair {
    constructor(privateKey: any, publicKey: any);
    privateKey: any;
    publicKey: any;
    getPrivateKey(): any;
    getPublicKey(): any;
}
export {};
