# Hybrid Post Quantum Cryptography SDK in JavaScript

See https://github.com/quantumcoinproject/hybrid-pqc for the underlying cryptography implementation details

Uses Dilithium, SPHINCS+ and ed25519 in hybrid post-quantum + classical mode

## Installing

    npm install quantum-coin-pqc-js-sdk

## APIs

### cryptoNewKeyPair()
Creates a new KeyPair and returns it.

#### Parameters

None

#### Return Type

Returns a KeyPair object.

PrivateKey is of size 4064 bytes. Can be accessed by calling `getPrivateKey()` 

PublicKey is of size 1408 bytes. Can be accessed by calling `getPublicKey()`

#### Error

Can throw `OperationFailedError` if the operation fails unexpectedly.

### cryptoSign(messageArray, privateKeyArray)
Signs a message and returns the signature. Currently, only the compact signing mode is supported. For more details, see https://github.com/quantumcoinproject/hybrid-pqc

#### Parameters

`messageArray` Currently, the only supported message length is 32 bytes.

`privateKeyArray` The private key to use to sign the message. Should be of length 4064 bytes.

#### Return Type

Returns the signature in a byte array of length 2558 bytes.

#### Error

Throws `InvalidArgumentsError` if arguments are invalid, such as incorrect length.

Can throw `OperationFailedError` if the operation fails unexpectedly.

### cryptoVerify(messageArray, sigArray, publicKeyArray)

Verifies a signature and the corresponding message, using the public key.

#### Parameters

`messageArray` Currently, the only supported message length is 32 bytes. Pass the message used for signing.

> **Warning**
>
> You should not extract this message from the signature itself. Instead, construct the message as your application does originally when signing. Otherwise signatures can be forged.
> Likewise, you should check any message passed directly from external input to your application, that it is valid.      

`sigArray` The signature to be verified. Should be of length 2558 bytes.

`publicKeyArray` The public key to use to verify the signature. Should be of length 1408 bytes.

#### Return Type

Returns `true` if the verification succeeded. Otherwise, returns `false`.

#### Error

Throws `InvalidArgumentsError` if arguments are invalid, such as incorrect length.

Can throw `OperationFailedError` if the operation fails unexpectedly. One of the reasons this can happen is if the signature is tampered with or malformed.

## Example

```javascript
var pqc = require('quantum-coin-pqc-js-sdk')

/*
  Just an example for hashing a message 
*/
async function cryptoHash(data) {
    const msgUint8 = new TextEncoder().encode(data); // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
    // convert buffer to byte array
    return Array.from(new Uint8Array(hashBuffer));
}

let msg = "Hello World";

cryptoHash(msg).then((msgHash) => {
    /*Creating a key*/
    let keyPair = pqc.cryptoNewKeyPair();

    /*Signing a message with a key. Currently, the only supported message size is 32 bytes. */
    let signature = pqc.cryptoSign(msgHash, keyPair.getPrivateKey());
    
    /*Verifying a signed message*/
    let verifyOk = pqc.cryptoVerify(msgHash, signature, keyPair.getPublicKey());
    if(verifyOk) {
        console.log("Verify succeeded");
    } else {
        console.error("Verify failed");
    }
});
```

## Notes

The file `hybrid-pqc-node.js` is copied from https://github.com/DogeProtocol/hybrid-pqc/releases/download/v0.1.38/hybrid-pqc-nodejs-wasm.tar.gz

This library does not perform any memory cleansing, such as setting private-key bytes to zero after usage.



