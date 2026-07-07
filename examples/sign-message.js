/**
 * Example: EIP-191 message signing (personal_sign) — offline, no blockchain required.
 * Run: node examples/sign-message.js  (or VERBOSE=1 node examples/sign-message.js)
 *
 * Demonstrates how to:
 * - hash a message (EIP-191 digest, same prefix as Ethereum)
 * - sign it with `wallet.signMessage()` (async) and `wallet.signMessageSync()`
 * - recover the signer address with `verifyMessage()` (synchronous)
 * - pass an optional `signingContext`
 * - detect tampering (verification of a modified message throws)
 *
 * QuantumCoin note: the signature is an opaque post-quantum blob (multi-KB hex)
 * that embeds the signer's public key, and addresses are 32 bytes — there is no
 * ECDSA `(r, s, v)` / `ecrecover`.
 */

const { Initialize } = require("../config");
const { Wallet, hashMessage, verifyMessage } = require("..");
const { logExample, logAddress } = require("../test/verbose-logger");

async function signMessageExample() {
  logExample("sign-message.js", "starting");
  await Initialize(null);

  const wallet = Wallet.createRandom();
  console.log("Wallet address:", wallet.address);
  logAddress("wallet", wallet.address);

  const message = "Sign in to the QuantumCoin dApp";

  // EIP-191 digest (32 bytes) — the same value signMessage/verifyMessage use.
  const digest = hashMessage(message);
  console.log("Message:", JSON.stringify(message));
  console.log("EIP-191 digest:", digest);

  // Async signing (honors the ethers Signer interface).
  const signature = await wallet.signMessage(message);
  console.log("Signature length (hex chars):", signature.length);
  console.log("Signature (first 40 chars):", signature.slice(0, 40) + "...");

  // Synchronous signing produces a different blob (PQC signatures are
  // randomized) but recovers to the same address.
  const signatureSync = wallet.signMessageSync(message);

  // Recover the signer address. verifyMessage is synchronous.
  const recovered = verifyMessage(message, signature);
  const recoveredSync = verifyMessage(message, signatureSync);
  console.log("Recovered address:        ", recovered);
  console.log("Matches wallet address:   ", recovered === wallet.address);
  console.log("Sync signature recovers to:", recoveredSync === wallet.address);
  logAddress("recovered", recovered);

  // Optional signing context: `2` requests the full-signature scheme for a
  // keyType 3 wallet (default derives a compact context from the key type).
  const fullSig = wallet.signMessageSync(message, 2);
  console.log("Full-context signature recovers:", verifyMessage(message, fullSig) === wallet.address);

  // Tamper detection: verifying a modified message fails.
  try {
    verifyMessage(message + " (tampered)", signature);
    console.log("Tamper check: UNEXPECTEDLY verified (should not happen)");
  } catch (err) {
    console.log("Tamper check: rejected as expected ->", err.code || err.message);
  }

  logExample("sign-message.js", "done", { signatureLength: signature.length });
}

signMessageExample().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
