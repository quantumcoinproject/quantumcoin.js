/**
 * @testCategory unit
 * @blockchainRequired false
 * @transactional false
 * @description EIP-191 message signing: hashMessage, Wallet.signMessage/signMessageSync, verifyMessage
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const qc = require("../../index");
const { Initialize } = require("../../config");
const { logSuite, logTest } = require("../verbose-logger");

// keccak256("\x19Ethereum Signed Message:\n9Hello Joe") produced by
// quantum-coin-go accounts.TextHash — locks cross-implementation parity.
const GO_TEXTHASH_HELLO_JOE =
  "0xa080337ae51c4e064c189e113edd0ba391df9206e2f49db658bb32cf2911730b";

// Every sign/verify assertion runs for each of these key-type / signing-context
// combinations (mirrors quantum-coin-js-sdk/tests/sign-verify.test.js). keyType 3
// supports the compact (0, and null->0) and full (2) contexts; keyType 5 uses 1
// (and null->1).
const COMBOS = [
  { keyType: 3, signingContext: null, label: "keyType 3 / ctx null (compact)" },
  { keyType: 3, signingContext: 0, label: "keyType 3 / ctx 0 (compact)" },
  { keyType: 3, signingContext: 2, label: "keyType 3 / ctx 2 (full)" },
  { keyType: 5, signingContext: null, label: "keyType 5 / ctx null" },
  { keyType: 5, signingContext: 1, label: "keyType 5 / ctx 1" },
];

// Flip every bit of the byte at `byteOffset` inside a 0x hex string.
function tamperHexByte(hex, byteOffset) {
  const clean = hex.slice(2);
  const i = byteOffset * 2;
  const flipped = (parseInt(clean.slice(i, i + 2), 16) ^ 0xff).toString(16).padStart(2, "0");
  return "0x" + clean.slice(0, i) + flipped + clean.slice(i + 2);
}

describe("Message signing (EIP-191)", () => {
  logSuite("Message signing (EIP-191)");

  before(async () => {
    // Crypto primitives are provided by quantum-coin-js-sdk, which must be
    // initialized before use.
    await Initialize(null);
  });

  describe("hashMessage", () => {
    it("matches the quantum-coin-go accounts.TextHash vector", () => {
      logTest("hashMessage matches go TextHash vector", {});
      assert.equal(qc.hashMessage("Hello Joe"), GO_TEXTHASH_HELLO_JOE);
    });

    it("returns a 0x-prefixed 32-byte digest", () => {
      const out = qc.hashMessage("anything");
      assert.ok(out.startsWith("0x"));
      assert.equal(out.length, 66);
    });

    it("treats a string and its UTF-8 bytes identically", () => {
      const asString = qc.hashMessage("Hello Joe");
      const asBytes = qc.hashMessage(qc.toUtf8Bytes("Hello Joe"));
      assert.equal(asString, asBytes);
    });
  });

  describe("sign / verify round trips (all signing contexts)", () => {
    for (const combo of COMBOS) {
      it(`${combo.label}: signMessage(Sync) round-trips through verifyMessage`, async () => {
        logTest("sign/verify round trip", { keyType: combo.keyType, ctx: combo.signingContext });
        const wallet = qc.Wallet.createRandom(undefined, combo.keyType);
        const message = `Sign in to the QuantumCoin dApp | ${combo.label}`;

        const sigSync = wallet.signMessageSync(message, combo.signingContext);
        assert.ok(sigSync.startsWith("0x") && sigSync.length > 2);
        assert.equal(qc.verifyMessage(message, sigSync), wallet.address);

        // Async wrapper parity: PQC signatures are randomized so the bytes differ,
        // but both must recover the same signer address.
        const sigAsync = await wallet.signMessage(message, combo.signingContext);
        assert.equal(qc.verifyMessage(message, sigAsync), wallet.address);

        // Uint8Array message input is accepted and equivalent.
        const sigBytesInput = wallet.signMessageSync(qc.toUtf8Bytes(message), combo.signingContext);
        assert.equal(qc.verifyMessage(qc.toUtf8Bytes(message), sigBytesInput), wallet.address);
        assert.equal(qc.verifyMessage(message, sigBytesInput), wallet.address);
      });

      it(`${combo.label}: verifyMessage rejects all tampering (negative cases)`, () => {
        logTest("negative verification", { keyType: combo.keyType, ctx: combo.signingContext });
        const wallet = qc.Wallet.createRandom(undefined, combo.keyType);
        const message = `Approve connection | ${combo.label}`;
        const sig = wallet.signMessageSync(message, combo.signingContext);

        // Tampered message -> digest changes -> embedded pubkey fails to verify.
        assert.throws(() => qc.verifyMessage(message + "!", sig));

        // Tampered scheme id byte (first byte of the signature part, offset 4 after
        // the 2-byte total-length + 2-byte part-length header) -> unknown type.
        assert.throws(() => qc.verifyMessage(message, tamperHexByte(sig, 4)));

        // Tampered byte inside the signature body -> verification fails.
        assert.throws(() => qc.verifyMessage(message, tamperHexByte(sig, 32)));

        // Truncated signature -> cannot be parsed / verified.
        assert.throws(() => qc.verifyMessage(message, sig.slice(0, sig.length - 40)));

        // Cross-signer: a different wallet's signature must not resolve to this
        // wallet's address.
        const other = qc.Wallet.createRandom(undefined, combo.keyType);
        const otherSig = other.signMessageSync(message, combo.signingContext);
        assert.equal(qc.verifyMessage(message, otherSig), other.address);
        assert.notEqual(qc.verifyMessage(message, otherSig), wallet.address);
      });
    }
  });

  describe("malformed signature inputs", () => {
    it("throws for empty, null, non-hex, and too-short signatures", () => {
      const message = "hello";
      assert.throws(() => qc.verifyMessage(message, ""));
      assert.throws(() => qc.verifyMessage(message, null));
      assert.throws(() => qc.verifyMessage(message, "not-hex"));
      assert.throws(() => qc.verifyMessage(message, "0x1234"));
    });
  });

  describe("message size limit", () => {
    const MAX_MESSAGE_BYTES = 1024 * 1024;
    const isInvalidArgument = (e) => e && e.code === "INVALID_ARGUMENT";

    it("signMessageSync rejects a message larger than the 1 MiB limit", () => {
      const wallet = qc.Wallet.createRandom(undefined, 3);
      const tooBig = "a".repeat(MAX_MESSAGE_BYTES + 1);
      assert.throws(() => wallet.signMessageSync(tooBig), isInvalidArgument);
      assert.throws(() => wallet.signMessageSync(qc.toUtf8Bytes(tooBig)), isInvalidArgument);
    });

    it("signMessage (async) rejects an over-limit message", async () => {
      const wallet = qc.Wallet.createRandom(undefined, 3);
      const tooBig = "a".repeat(MAX_MESSAGE_BYTES + 1);
      await assert.rejects(wallet.signMessage(tooBig), isInvalidArgument);
    });

    it("signMessageSync accepts a message exactly at the limit", () => {
      const wallet = qc.Wallet.createRandom(undefined, 3);
      const atLimit = "a".repeat(MAX_MESSAGE_BYTES);
      const sig = wallet.signMessageSync(atLimit);
      assert.equal(qc.verifyMessage(atLimit, sig), wallet.address);
    });
  });

  describe("deterministic verification vectors", () => {
    const fixturePath = path.join(__dirname, "fixtures", "message-signing-vectors.json");
    const { vectors } = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

    it("fixture covers every signing-context combination", () => {
      assert.equal(vectors.length, COMBOS.length);
    });

    for (const v of vectors) {
      const label = `keyType ${v.keyType} / ctx ${String(v.signingContext)}`;

      it(`${label}: verifyMessage recovers the hardcoded address`, () => {
        logTest("deterministic vector", { keyType: v.keyType, ctx: v.signingContext });
        assert.equal(qc.verifyMessage(v.message, v.signature), v.address);
      });

      it(`${label}: flipping a signature byte fails verification`, () => {
        assert.throws(() => qc.verifyMessage(v.message, tamperHexByte(v.signature, 32)));
      });

      it(`${label}: flipping a message byte fails verification`, () => {
        assert.throws(() => qc.verifyMessage(v.message + "x", v.signature));
      });
    }
  });
});
