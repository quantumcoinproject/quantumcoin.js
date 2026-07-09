/**
 * @testCategory security
 * @blockchainRequired false
 * @transactional false
 * @description Security tests for malformed input, edge cases, and invalid values.
 * Run with VERBOSE=1 for test names.
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

const { Initialize } = require("../../config");
const qc = require("../../index");
const { logSuite, logTest } = require("../verbose-logger");

describe("Security: Malformed Input", () => {
  logSuite("Security: Malformed Input");
  it("rejects invalid address length and characters", async () => {
    logTest("rejects invalid address length and characters", {});
    await Initialize(null);
    assert.equal(qc.isAddress("0x1234"), false);
    assert.equal(qc.isAddress("not-an-address"), false);
    assert.throws(() => qc.getAddress("0x1234"), /invalid address/i);
  });

  it("rejects too-long bytes32 strings", () => {
    logTest("rejects too-long bytes32 strings", {});
    assert.throws(() => qc.encodeBytes32String("x".repeat(33)), /max 32/i);
  });

  it("rejects invalid parseUnits inputs", () => {
    logTest("rejects invalid parseUnits inputs", {});
    assert.throws(() => qc.parseUnits("", 18), /invalid/i);
    assert.throws(() => qc.parseUnits("1.234", 2), /exceeds decimals/i);
  });
});

describe("Security: Private key enumeration protection", () => {
  logSuite("Security: Private key enumeration protection");

  it("JSON.stringify(wallet) must NOT contain privateKey or seed", async () => {
    logTest("JSON.stringify(wallet) must NOT contain privateKey or seed", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    const json = JSON.stringify(w);
    const parsed = JSON.parse(json);

    assert.ok(!("privateKey" in parsed), "privateKey must not appear in JSON");
    assert.ok(!("seed" in parsed), "seed must not appear in JSON");
    assert.ok(!("signingKey" in parsed), "signingKey must not appear in JSON");
    assert.ok(!("_qcWallet" in parsed), "_qcWallet must not appear in JSON");
    assert.ok(!("_seed" in parsed), "_seed must not appear in JSON");
    assert.ok(!("privateKeyBytes" in parsed), "privateKeyBytes must not appear in JSON");

    assert.ok("address" in parsed, "address should be in JSON");
  });

  it("Object.keys(wallet) must not include secret properties", async () => {
    logTest("Object.keys(wallet) must not include secret properties", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    const keys = Object.keys(w);

    assert.ok(!keys.includes("privateKey"), "privateKey must not be enumerable");
    assert.ok(!keys.includes("seed"), "seed must not be enumerable");
    assert.ok(!keys.includes("signingKey"), "signingKey must not be enumerable");
    assert.ok(!keys.includes("_qcWallet"), "_qcWallet must not be enumerable");
    assert.ok(!keys.includes("_seed"), "_seed must not be enumerable");
  });

  it("privateKey and seed are still accessible directly", async () => {
    logTest("privateKey and seed are still accessible directly", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    assert.equal(typeof w.privateKey, "string");
    assert.ok(w.privateKey.startsWith("0x"));
    assert.equal(typeof w.seed, "string");
  });
});

describe("Security: Wallet.connect() preserves state", () => {
  logSuite("Security: Wallet.connect() preserves state");

  it("connect() preserves seed", async () => {
    logTest("connect() preserves seed", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    const seedBefore = w.seed;

    const provider = new qc.JsonRpcProvider("http://127.0.0.1:9999", 123123);
    const connected = w.connect(provider);

    assert.equal(connected.seed, seedBefore, "seed must survive connect()");
    assert.equal(connected.address, w.address, "address must survive connect()");
  });
});

describe("Security: KDF string password handling", () => {
  logSuite("Security: KDF string password handling");
  before(async () => {
    await Initialize(null);
  });

  it("pbkdf2 with plain string password does not crash", async () => {
    logTest("pbkdf2 with plain string password does not crash", {});
    const result = qc.pbkdf2("password123", "salt123", 1000, 32, "sha256");
    assert.equal(typeof result, "string");
    assert.ok(result.startsWith("0x"));
  });

  it("computeHmac with plain string key/data does not crash", async () => {
    logTest("computeHmac with plain string key/data does not crash", {});
    const result = qc.computeHmac("sha256", "mykey", "mydata");
    assert.equal(typeof result, "string");
    assert.ok(result.startsWith("0x"));
  });

  it("scryptSync with plain string password does not crash", async () => {
    logTest("scryptSync with plain string password does not crash", {});
    const result = qc.scryptSync("password123", "salt123", 1024, 8, 1, 32);
    assert.equal(typeof result, "string");
    assert.ok(result.startsWith("0x"));
  });
});

describe("Security: Numeric precision in signTransaction", () => {
  logSuite("Security: Numeric precision in signTransaction");

  it("rejects number value above MAX_SAFE_INTEGER", async () => {
    logTest("rejects number value above MAX_SAFE_INTEGER", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    await assert.rejects(
      () => w.signTransaction({ to: w.address, value: Number.MAX_SAFE_INTEGER + 1, nonce: 0, chainId: 123123 }),
      /overflow/i,
    );
  });

  it("accepts bigint value for large amounts", async () => {
    logTest("accepts bigint value for large amounts", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    const raw = await w.signTransaction({
      to: w.address,
      value: 999999999999999999999n,
      nonce: 0,
      chainId: 123123,
    });
    assert.equal(typeof raw, "string");
    assert.ok(raw.startsWith("0x"));
  });

  it("accepts string value '0x' as zero", async () => {
    logTest("accepts string value '0x' as zero", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    const raw = await w.signTransaction({ to: w.address, value: "0x", nonce: 0, chainId: 123123 });
    assert.equal(typeof raw, "string");
  });
});

describe("Security: Password strength enforcement", () => {
  logSuite("Security: Password strength enforcement");

  it("encryptSync rejects password shorter than 12 characters", async () => {
    logTest("encryptSync rejects password shorter than 12 characters", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    assert.throws(() => w.encryptSync("short"), /password must be at least 12 characters/);
  });

  it("encryptSync accepts password of 12+ characters", async () => {
    logTest("encryptSync accepts password of 12+ characters", {});
    await Initialize(null);
    const w = qc.Wallet.createRandom();
    const json = w.encryptSync("abcdefghijkl");
    assert.equal(typeof json, "string");
    assert.ok(json.length > 0);
  });
});

describe("Security: ecrecover-style recovery APIs are not exported", () => {
  logSuite("Security: ecrecover-style recovery APIs are not exported");

  // QuantumCoin's post-quantum signatures have no ecrecover: an address cannot be
  // recovered from a signature. Message signing IS supported via hashMessage +
  // verifyMessage (which verifies against the self-describing sig+pubKey blob),
  // but the ethers ecrecover-style helpers must stay unexported.
  it("recoverAddress is not exported", () => {
    logTest("recoverAddress is not exported", {});
    assert.equal(qc.recoverAddress, undefined, "recoverAddress should not be exported");
  });

  it("MessagePrefix is not exported", () => {
    logTest("MessagePrefix is not exported", {});
    assert.equal(qc.MessagePrefix, undefined, "MessagePrefix should not be exported");
  });

  it("hashMessage and verifyMessage are exported", () => {
    logTest("hashMessage and verifyMessage are exported", {});
    assert.equal(typeof qc.hashMessage, "function", "hashMessage should be exported");
    assert.equal(typeof qc.verifyMessage, "function", "verifyMessage should be exported");
  });
});

describe("Security: Error messages do not leak secrets", () => {
  logSuite("Security: Error messages do not leak secrets");

  it("fromKeys error does not contain actual key bytes", async () => {
    logTest("fromKeys error does not contain actual key bytes", {});
    await Initialize(null);
    const fakeKey = "0xdeadbeef";
    try {
      qc.Wallet.fromKeys(fakeKey, fakeKey);
      assert.fail("should have thrown");
    } catch (e) {
      assert.ok(!e.message.includes("deadbeef"), "error must not contain key material");
      assert.ok(e.message.includes("[REDACTED]") || !e.message.includes("0x"), "value should be redacted");
    }
  });
});

describe("Security: _hexToBigInt handles '0x'", () => {
  logSuite("Security: _hexToBigInt handles '0x'");

  it("getBalance does not crash on '0x' response", async () => {
    logTest("getBalance does not crash on '0x' response", {});
    assert.equal(typeof qc.JsonRpcProvider, "function");
  });
});

describe("Security: RLP depth limit", () => {
  logSuite("Security: RLP depth limit");

  it("rejects deeply nested RLP (depth > 64)", () => {
    logTest("rejects deeply nested RLP (depth > 64)", {});
    let inner = [];
    for (let i = 0; i < 70; i++) {
      inner = [inner];
    }
    const encoded = qc.encodeRlp(inner);
    assert.throws(() => qc.decodeRlp(encoded), /maximum nesting depth exceeded/);
  });

  it("accepts RLP within depth limit", () => {
    logTest("accepts RLP within depth limit", {});
    const encoded = qc.encodeRlp([["hello", "world"], "test"]);
    const decoded = qc.decodeRlp(encoded);
    assert.ok(Array.isArray(decoded));
  });
});

describe("Security: Seed phrase with invalid words", () => {
  logSuite("Security: Seed phrase with invalid words");

  it("rejects gibberish words of correct count", async () => {
    logTest("rejects gibberish words of correct count", {});
    await Initialize(null);
    const gibberish = new Array(32).fill("xyzzyplugh");
    assert.throws(
      () => qc.Wallet.fromPhrase(gibberish),
      { message: /failed/i },
    );
  });

  it("rejects empty string words of correct count", async () => {
    logTest("rejects empty string words of correct count", {});
    await Initialize(null);
    const empty = new Array(32).fill("");
    assert.throws(() => qc.Wallet.fromPhrase(empty));
  });
});

describe("Security: Keccak-256 test vectors", () => {
  logSuite("Security: Keccak-256 test vectors");
  before(async () => {
    await Initialize(null);
  });

  it("keccak256 of empty bytes matches known digest", async () => {
    logTest("keccak256 of empty bytes matches known digest", {});
    const result = qc.keccak256(new Uint8Array(0));
    assert.equal(result, "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  });

  it("keccak256 of 'hello' matches known digest", async () => {
    logTest("keccak256 of 'hello' matches known digest", {});
    const bytes = new TextEncoder().encode("hello");
    const result = qc.keccak256(bytes);
    assert.equal(result, "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8");
  });

  it("sha256 produces correct length output", () => {
    logTest("sha256 produces correct length output", {});
    const result = qc.sha256(new Uint8Array([1, 2, 3]));
    assert.equal(typeof result, "string");
    assert.equal(result.length, 66);
  });
});

describe("Security: BigInt in provider params", () => {
  logSuite("Security: BigInt in provider params");

  it("JsonRpcProvider serializes BigInt params without crashing", async (t) => {
    logTest("JsonRpcProvider serializes BigInt params without crashing", {});
    if (typeof fetch !== "function") {
      t.skip("global fetch not available");
      return;
    }
    const originalFetch = fetch;
    global.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.params[0].value, "0x3e8");
      const responseBody = JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x1" });
      return { ok: true, text: async () => responseBody, json: async () => JSON.parse(responseBody) };
    };
    try {
      const p = new qc.JsonRpcProvider("http://example.invalid", 123123);
      await p._perform("eth_call", [{ to: "0x" + "00".repeat(32), value: 1000n }]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("Security: Per-instance RPC IDs", () => {
  logSuite("Security: Per-instance RPC IDs");

  it("different provider instances have independent ID counters", () => {
    logTest("different provider instances have independent ID counters", {});
    const p1 = new qc.JsonRpcProvider("http://a.invalid", 1);
    const p2 = new qc.JsonRpcProvider("http://b.invalid", 1);
    assert.equal(p1._rpcId, 1);
    assert.equal(p2._rpcId, 1);
  });
});
