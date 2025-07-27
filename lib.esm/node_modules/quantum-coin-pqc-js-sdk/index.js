//index.js

var hybridpqc = require('./hybrid-pqc-node');

function CryptoRandomError () {
}

CryptoRandomError.prototype = new Error();

function InvalidArgumentsError () {
}

InvalidArgumentsError.prototype = new Error();

function OperationFailedError () {
}

OperationFailedError.prototype = new Error();

const CRYPTO_OK = 0
const CRYPTO_SEED_BYTES = 96
const CRYPTO_EXPANDED_SEED_BYTES = 160
const CRYPTO_MESSAGE_LEN = 32
const CRYPTO_SECRETKEY_BYTES = 4064
const CRYPTO_PUBLICKEY_BYTES = 1408
const CRYPTO_COMPACT_SIGNATURE_BYTES = 2558

class KeyPair {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  getPrivateKey() {
    return this.privateKey;
  }

  getPublicKey() {
    return this.publicKey;
  }
}

function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) =>
      String.fromCodePoint(byte),
  ).join("");
  return btoa(binString);
}

function cryptoRandom(size) {
  let randPtr = hybridpqc._mem_alloc(size * Uint8Array.BYTES_PER_ELEMENT);
  let ret = hybridpqc._dp_randombytes(randPtr, size);
  if (ret !== CRYPTO_OK) {
    hybridpqc._mem_free(randPtr);
    throw new CryptoRandomError;
  }
  const randBuf = new Uint8Array(hybridpqc.HEAPU8.buffer, randPtr, size);

  const typedRandArray = new Uint8Array(size);

  for (let i = 0; i < randBuf.length; i++) {
    typedRandArray[i] = randBuf[i];
  }

  hybridpqc._mem_free(randPtr);
  return typedRandArray;
}

function cryptoNewSeed() {
  return cryptoRandom(CRYPTO_SEED_BYTES);
}

function cryptoExpandSeed(seedArray) {
  if (seedArray == null || seedArray.length !== CRYPTO_SEED_BYTES) {
    throw new InvalidArgumentsError;
  }

  //Create seed array input
  const typedSeedArray = new Uint8Array(CRYPTO_SEED_BYTES);
  for (let i = 0; i < CRYPTO_SEED_BYTES; i++) {
    typedSeedArray[i] = seedArray[i];
  }
  const seedPtr = hybridpqc._mem_alloc(typedSeedArray.length * typedSeedArray.BYTES_PER_ELEMENT);
  hybridpqc.HEAPU8.set(typedSeedArray, seedPtr);

  //Expanded seed buffer
  let expandedSeedPtr = hybridpqc._mem_alloc(CRYPTO_EXPANDED_SEED_BYTES * Uint8Array.BYTES_PER_ELEMENT);

  let ret = hybridpqc._dp_sign_seedexpander(seedPtr, expandedSeedPtr);
  if (ret !== CRYPTO_OK) {
    hybridpqc._mem_free(seedPtr);
    hybridpqc._mem_free(expandedSeedPtr);
    throw new OperationFailedError;
  }

  //Copy back return
  const expandedSeedBuf = new Uint8Array(hybridpqc.HEAPU8.buffer, expandedSeedPtr, CRYPTO_EXPANDED_SEED_BYTES);
  const typedExpandedSeedArray = new Uint8Array(CRYPTO_EXPANDED_SEED_BYTES);

  for (let i = 0; i < CRYPTO_EXPANDED_SEED_BYTES; i++) {
    typedExpandedSeedArray[i] = expandedSeedBuf[i];
  }

  hybridpqc._mem_free(seedPtr);
  hybridpqc._mem_free(expandedSeedPtr);

  return typedExpandedSeedArray;
}

function cryptoNewKeyPair() {
  let expandedSeedArray = cryptoRandom(CRYPTO_EXPANDED_SEED_BYTES);
  return cryptoNewKeyPairFromSeed(expandedSeedArray);
}

function cryptoNewKeyPairFromSeed(expandedSeedArray) {
  if (expandedSeedArray.length !== CRYPTO_EXPANDED_SEED_BYTES) {
    throw new InvalidArgumentsError;
  }

  let pkPtr = hybridpqc._mem_alloc(CRYPTO_PUBLICKEY_BYTES * Uint8Array.BYTES_PER_ELEMENT);
  let skPtr = hybridpqc._mem_alloc(CRYPTO_SECRETKEY_BYTES * Uint8Array.BYTES_PER_ELEMENT);

  const typedSeedArray = new Uint8Array(CRYPTO_EXPANDED_SEED_BYTES);
  const seedPtr = hybridpqc._mem_alloc(typedSeedArray.length * typedSeedArray.BYTES_PER_ELEMENT);

  for (let i = 0; i < expandedSeedArray.length; i++) {
    typedSeedArray[i] = expandedSeedArray[i];
  }

  hybridpqc.HEAPU8.set(typedSeedArray, seedPtr);

  let ret = hybridpqc._dp_sign_keypair_seed(pkPtr, skPtr, seedPtr);

  if (ret !== CRYPTO_OK) {
    hybridpqc._mem_free(seedPtr);
    hybridpqc._mem_free(skPtr);
    hybridpqc._mem_free(pkPtr);

    throw new OperationFailedError;
  }

  const skBuf = new Uint8Array(hybridpqc.HEAPU8.buffer, skPtr, CRYPTO_SECRETKEY_BYTES);
  const pkBuf = new Uint8Array(hybridpqc.HEAPU8.buffer, pkPtr, CRYPTO_PUBLICKEY_BYTES);

  const skArray = new Uint8Array(CRYPTO_SECRETKEY_BYTES);
  const pkArray = new Uint8Array(CRYPTO_PUBLICKEY_BYTES);

  for (let i = 0; i < CRYPTO_SECRETKEY_BYTES; i++) {
    skArray[i] = skBuf[i];
  }

  for (let i = 0; i < CRYPTO_PUBLICKEY_BYTES; i++) {
    pkArray[i] = pkBuf[i];
  }

  hybridpqc._mem_free(seedPtr);
  hybridpqc._mem_free(skPtr);
  hybridpqc._mem_free(pkPtr);

  return new KeyPair(skArray, pkArray);
}

function cryptoSign(messageArray, privateKeyArray) {
  if (messageArray == null || messageArray.length !== CRYPTO_MESSAGE_LEN || privateKeyArray.length == null || privateKeyArray.length !== CRYPTO_SECRETKEY_BYTES) {
    throw new InvalidArgumentsError;
  }

  let smPtr = hybridpqc._mem_alloc(CRYPTO_COMPACT_SIGNATURE_BYTES * Uint8Array.BYTES_PER_ELEMENT);
  let smlPtr = hybridpqc._mem_alloc_long_long(1 * BigUint64Array.BYTES_PER_ELEMENT);

  const typedMsgArray = new Uint8Array(messageArray.length);
  for (let i = 0; i < messageArray.length; i++) {
    typedMsgArray[i] = messageArray[i];
  }
  const msgPtr = hybridpqc._mem_alloc(typedMsgArray.length * typedMsgArray.BYTES_PER_ELEMENT);
  hybridpqc.HEAPU8.set(typedMsgArray, msgPtr);

  const typedSkArray = new Uint8Array(privateKeyArray.length);
  for (let i = 0; i < privateKeyArray.length; i++) {
    typedSkArray[i] = privateKeyArray[i];
  }
  const skyPtr = hybridpqc._mem_alloc(typedSkArray.length * typedSkArray.BYTES_PER_ELEMENT);
  hybridpqc.HEAPU8.set(typedSkArray, skyPtr);

  let ret = hybridpqc._dp_sign(smPtr, smlPtr, msgPtr, typedMsgArray.length, skyPtr);
  if (ret !== CRYPTO_OK) {
    hybridpqc._mem_free(msgPtr);
    hybridpqc._mem_free(skyPtr);
    hybridpqc._mem_free(smlPtr);
    hybridpqc._mem_free(smPtr);

    throw new OperationFailedError;
  }

  const sigLenBuf = new BigUint64Array(hybridpqc.HEAPU8.buffer, smlPtr, 1);

  const sigBuf = new Uint8Array(hybridpqc.HEAPU8.buffer, smPtr, sigLenBuf);
  const sigArray = new Uint8Array(CRYPTO_COMPACT_SIGNATURE_BYTES);
  for (let i = 0; i < CRYPTO_COMPACT_SIGNATURE_BYTES; i++) {
    sigArray[i] = sigBuf[i];
  }

  hybridpqc._mem_free(msgPtr);
  hybridpqc._mem_free(skyPtr);
  hybridpqc._mem_free(smlPtr);
  hybridpqc._mem_free(smPtr);

  return sigArray;
}

function cryptoVerify(messageArray, sigArray, publicKeyArray) {
  if (messageArray == null || messageArray.length !== CRYPTO_MESSAGE_LEN || sigArray.length == null || sigArray.length !== CRYPTO_COMPACT_SIGNATURE_BYTES || publicKeyArray == null || publicKeyArray.length !== CRYPTO_PUBLICKEY_BYTES) {
    throw InvalidArgumentsError;
  }

  const typedMsgArray = new Uint8Array(messageArray.length);
  for (let i = 0; i < messageArray.length; i++) {
    typedMsgArray[i] = messageArray[i];
  }
  const msgPtr = hybridpqc._mem_alloc(typedMsgArray.length * typedMsgArray.BYTES_PER_ELEMENT);
  hybridpqc.HEAPU8.set(typedMsgArray, msgPtr);

  const typedSmArray = new Uint8Array(sigArray.length);
  for (let i = 0; i < sigArray.length; i++) {
    typedSmArray[i] = sigArray[i];
  }
  const smPtr = hybridpqc._mem_alloc(typedSmArray.length * typedSmArray.BYTES_PER_ELEMENT);
  hybridpqc.HEAPU8.set(typedSmArray, smPtr);

  const typedPkArray = new Uint8Array(publicKeyArray.length);
  for (let i = 0; i < publicKeyArray.length; i++) {
    typedPkArray[i] = publicKeyArray[i];
  }
  const pkyPtr = hybridpqc._mem_alloc(typedPkArray.length * typedPkArray.BYTES_PER_ELEMENT);
  hybridpqc.HEAPU8.set(typedPkArray, pkyPtr);

  let ret = hybridpqc._dp_sign_verify(msgPtr, typedMsgArray.length, smPtr, typedSmArray.length, pkyPtr);
  hybridpqc._mem_free(msgPtr);
  hybridpqc._mem_free(smPtr);
  hybridpqc._mem_free(pkyPtr);

  if (ret !== CRYPTO_OK) {
    return false;
  }

  return true;
}

module.exports = {
  cryptoRandom,
  cryptoNewSeed,
  cryptoExpandSeed,
  cryptoNewKeyPair,
  cryptoNewKeyPairFromSeed,
  cryptoSign,
  cryptoVerify
};
