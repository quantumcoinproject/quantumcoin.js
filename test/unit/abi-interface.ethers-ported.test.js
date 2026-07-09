/**
 * @testCategory unit
 * @blockchainRequired false
 * @transactional false
 * @description ABI Interface/AbiCoder tests ported from ethers.js v6, adapted for
 *   QuantumCoin's 32-byte addresses.
 *
 * Adaptation rules (see plan):
 * - Canonical signatures are identical strings to Ethereum, so keccak-derived
 *   selectors / topic0 match ethers EXACTLY and are asserted against the same
 *   well-known constants (e.g. transfer(address,uint256) => 0xa9059cbb).
 * - QuantumCoin addresses are 32 bytes: an `address` occupies the whole 32-byte
 *   ABI word (Ethereum left-pads 12 zero bytes + 20 bytes). Word/offset layout is
 *   unchanged, so only the address word contents differ. Address-bearing vectors
 *   are recomputed via the QuantumCoin encoder itself and asserted by round-trip.
 * - EIP-55 checksum / ENS vectors are dropped (not applicable to 32-byte QC).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { Initialize } = require("../../config");
const qc = require("../../index");

// A deterministic 32-byte QuantumCoin address built by repeating a byte.
function A32(byteHex) {
  return "0x" + String(byteHex).repeat(32);
}

const WORD_ZERO = "0".repeat(64);
function word(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return (WORD_ZERO + h).slice(-64);
}

describe("ethers-ported: AbiCoder (elementary types)", () => {
  it("uint256 canonical encoding + round-trip", async () => {
    await Initialize(null);
    const coder = qc.AbiCoder.defaultAbiCoder();
    const enc = coder.encode(["uint256"], [1n]);
    assert.equal(enc, "0x" + word("01"));
    assert.equal(coder.decode(["uint256"], enc)[0], 1n);

    const big = (1n << 255n) + 123n;
    assert.equal(coder.decode(["uint256"], coder.encode(["uint256"], [big]))[0], big);
  });

  it("int256 handles negative values (two's complement) round-trip", async () => {
    await Initialize(null);
    const coder = qc.AbiCoder.defaultAbiCoder();
    for (const v of [0n, 1n, -1n, 255n, -256n, (1n << 200n), -(1n << 200n)]) {
      const enc = coder.encode(["int256"], [v]);
      assert.equal(coder.decode(["int256"], enc)[0], v);
    }
    // -1 encodes as all-ones word (ethers-identical).
    assert.equal(coder.encode(["int256"], [-1n]), "0x" + "f".repeat(64));
  });

  it("bool canonical encoding + round-trip", async () => {
    await Initialize(null);
    const coder = qc.AbiCoder.defaultAbiCoder();
    assert.equal(coder.encode(["bool"], [true]), "0x" + word("01"));
    assert.equal(coder.encode(["bool"], [false]), "0x" + word(""));
    assert.equal(coder.decode(["bool"], coder.encode(["bool"], [true]))[0], true);
    assert.equal(coder.decode(["bool"], coder.encode(["bool"], [false]))[0], false);
  });

  it("address occupies the full 32-byte word (QC adaptation, not 20-byte left-pad)", async () => {
    await Initialize(null);
    const coder = qc.AbiCoder.defaultAbiCoder();
    const addr = A32("ab");
    const enc = coder.encode(["address"], [addr]);
    // Whole word equals the address (contrast ethers: 12 zero bytes + 20 bytes).
    assert.equal(enc.toLowerCase(), addr.toLowerCase());
    assert.equal(coder.decode(["address"], enc)[0].toLowerCase(), addr.toLowerCase());
  });

  it("bytes32 round-trip", async () => {
    await Initialize(null);
    const coder = qc.AbiCoder.defaultAbiCoder();
    const b = A32("cd");
    const enc = coder.encode(["bytes32"], [b]);
    assert.equal(enc.toLowerCase(), b.toLowerCase());
    assert.equal(coder.decode(["bytes32"], enc)[0].toLowerCase(), b.toLowerCase());
  });
});

// Dynamic/array/tuple coverage goes through Interface with a proper ABI (which
// carries `components`), exercising the pure-JS coder deterministically.
describe("ethers-ported: Interface type matrix (round-trip via calldata)", () => {
  function roundTrip(iface, name, args) {
    const data = iface.encodeFunctionData(name, args);
    const decoded = iface.decodeFunctionData(name, data);
    // re-encode the decoded values through the resolved fragment must reproduce data
    const re = iface.encodeFunctionData(iface.getFunction(name), Array.from(decoded));
    assert.equal(re.toLowerCase(), data.toLowerCase());
    return decoded;
  }

  it("string + bytes (dynamic) round-trip", async () => {
    await Initialize(null);
    const iface = new qc.Interface([
      { type: "function", name: "f", outputs: [], inputs: [{ name: "s", type: "string" }, { name: "b", type: "bytes" }] },
    ]);
    const d = roundTrip(iface, "f", ["hello world", "0xdeadbeef"]);
    assert.equal(d.s, "hello world");
    assert.equal(d.b, "0xdeadbeef");
  });

  it("dynamic + fixed arrays round-trip", async () => {
    await Initialize(null);
    const iface = new qc.Interface([
      { type: "function", name: "f", outputs: [], inputs: [
        { name: "dyn", type: "uint256[]" },
        { name: "fix", type: "uint256[3]" }] },
    ]);
    const d = roundTrip(iface, "f", [[1n, 2n, 3n, 4n], [10n, 20n, 30n]]);
    assert.deepEqual(d.dyn, [1n, 2n, 3n, 4n]);
    assert.deepEqual(d.fix, [10n, 20n, 30n]);
  });

  it("address array round-trip (32-byte)", async () => {
    await Initialize(null);
    const iface = new qc.Interface([
      { type: "function", name: "f", outputs: [], inputs: [{ name: "addrs", type: "address[]" }] },
    ]);
    const a = [A32("11"), A32("22")];
    const d = roundTrip(iface, "f", [a]);
    assert.deepEqual(d.addrs.map((x) => x.toLowerCase()), a.map((x) => x.toLowerCase()));
  });

  it("tuple + nested tuple/array round-trip", async () => {
    await Initialize(null);
    const iface = new qc.Interface([
      { type: "function", name: "f", outputs: [], inputs: [
        { name: "order", type: "tuple", components: [
          { name: "maker", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "tags", type: "uint256[]" },
        ] }] },
    ]);
    const data = iface.encodeFunctionData("f", [{ maker: A32("aa"), amount: 500n, tags: [7n, 8n] }]);
    const d = iface.decodeFunctionData("f", data);
    assert.equal(d.order.maker.toLowerCase(), A32("aa").toLowerCase());
    assert.equal(d.order.amount, 500n);
    assert.deepEqual(d.order.tags, [7n, 8n]);
    const re = iface.encodeFunctionData(iface.getFunction("f"), Array.from(d));
    assert.equal(re.toLowerCase(), data.toLowerCase());
  });
});

describe("ethers-ported: Interface functions + selectors", () => {
  const ERC20 = [
    { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "balanceOf", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "event", name: "Transfer", anonymous: false, inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false }] },
  ];

  it("well-known selectors + topic0 match Ethereum exactly", async () => {
    await Initialize(null);
    const iface = new qc.Interface(ERC20);
    assert.equal(iface.getSighash("transfer"), "0xa9059cbb");
    assert.equal(iface.getSighash("approve"), "0x095ea7b3");
    assert.equal(iface.getSighash("balanceOf"), "0x70a08231");
    assert.equal(iface.getFunction("transfer").selector, "0xa9059cbb");
    assert.equal(
      iface.getEventTopic("Transfer"),
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    );
    assert.equal(iface.getEvent("Transfer").topicHash, "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");
  });

  it("parseTransaction on transfer calldata (32-byte address)", async () => {
    await Initialize(null);
    const iface = new qc.Interface(ERC20);
    const to = A32("42");
    const data = iface.encodeFunctionData("transfer", [to, 123456789n]);
    const parsed = iface.parseTransaction({ data });
    assert.equal(parsed.name, "transfer");
    assert.equal(parsed.signature, "transfer(address,uint256)");
    assert.equal(parsed.selector, "0xa9059cbb");
    assert.equal(parsed.args[0].toLowerCase(), to.toLowerCase());
    assert.equal(parsed.args.value, 123456789n);
    assert.equal(parsed.value, 0n);
  });
});

describe("ethers-ported: Interface errors", () => {
  it("standard Error(string) selector 0x08c379a0 parses", async () => {
    await Initialize(null);
    const iface = new qc.Interface([{ type: "error", name: "Error", inputs: [{ name: "message", type: "string" }] }]);
    assert.equal(iface.getError("Error").selector, "0x08c379a0");
    const data = new qc.Interface([{ type: "function", name: "Error", inputs: [{ name: "message", type: "string" }], outputs: [] }])
      .encodeFunctionData("Error", ["boom"]);
    const pe = iface.parseError(data);
    assert.equal(pe.name, "Error");
    assert.equal(pe.args.message, "boom");
    assert.equal(pe.selector, "0x08c379a0");
  });

  it("Panic(uint256) selector 0x4e487b71 parses", async () => {
    await Initialize(null);
    const iface = new qc.Interface([{ type: "error", name: "Panic", inputs: [{ name: "code", type: "uint256" }] }]);
    assert.equal(iface.getError("Panic").selector, "0x4e487b71");
    const data = new qc.Interface([{ type: "function", name: "Panic", inputs: [{ name: "code", type: "uint256" }], outputs: [] }])
      .encodeFunctionData("Panic", [0x11n]);
    const pe = iface.parseError(data);
    assert.equal(pe.args.code, 0x11n);
  });
});

describe("ethers-ported: negative cases", () => {
  // Range/length checks live in the pure-JS coder, exercised via fragment-based
  // encodeFunctionData (which always routes through it).
  function frag(iface, name) {
    return iface.getFunction(name);
  }

  it("uint8 overflow throws", async () => {
    await Initialize(null);
    const iface = new qc.Interface([{ type: "function", name: "f", inputs: [{ name: "x", type: "uint8" }], outputs: [] }]);
    assert.throws(() => iface.encodeFunctionData(frag(iface, "f"), [256n]), (e) => e && e.code === "INVALID_ARGUMENT");
    assert.throws(() => iface.encodeFunctionData(frag(iface, "f"), [-1n]), (e) => e && e.code === "INVALID_ARGUMENT");
    // 255 is fine.
    assert.ok(iface.encodeFunctionData(frag(iface, "f"), [255n]).startsWith("0x"));
  });

  it("int8 out-of-range throws", async () => {
    await Initialize(null);
    const iface = new qc.Interface([{ type: "function", name: "f", inputs: [{ name: "x", type: "int8" }], outputs: [] }]);
    assert.throws(() => iface.encodeFunctionData(frag(iface, "f"), [128n]), (e) => e && e.code === "INVALID_ARGUMENT");
    assert.throws(() => iface.encodeFunctionData(frag(iface, "f"), [-129n]), (e) => e && e.code === "INVALID_ARGUMENT");
    assert.ok(iface.encodeFunctionData(frag(iface, "f"), [-128n]).startsWith("0x"));
    assert.ok(iface.encodeFunctionData(frag(iface, "f"), [127n]).startsWith("0x"));
  });

  it("bytes4 wrong length throws", async () => {
    await Initialize(null);
    const iface = new qc.Interface([{ type: "function", name: "f", inputs: [{ name: "x", type: "bytes4" }], outputs: [] }]);
    assert.throws(() => iface.encodeFunctionData(frag(iface, "f"), ["0xdeadbeefaa"]), (e) => e && e.code === "INVALID_ARGUMENT");
    assert.ok(iface.encodeFunctionData(frag(iface, "f"), ["0xdeadbeef"]).startsWith("0x"));
  });

  it("wrong argument count throws", async () => {
    await Initialize(null);
    const iface = new qc.Interface([
      { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
    ]);
    assert.throws(() => iface.encodeFunctionData(frag(iface, "transfer"), [A32("11")]), (e) => e && e.code === "INVALID_ARGUMENT");
  });

  it("decoding truncated calldata throws", async () => {
    await Initialize(null);
    const iface = new qc.Interface([
      { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
    ]);
    const data = iface.encodeFunctionData("transfer", [A32("11"), 1n]);
    const truncated = data.slice(0, data.length - 8); // drop 4 bytes of the tail word
    assert.throws(() => iface.decodeFunctionData("transfer", truncated), (e) => e && e.code === "INVALID_ARGUMENT");
  });

  it("parseTransaction with an unknown selector throws", async () => {
    await Initialize(null);
    const iface = new qc.Interface([{ type: "function", name: "foo", inputs: [], outputs: [] }]);
    assert.throws(() => iface.parseTransaction({ data: "0x12345678" }), (e) => e && e.code === "INVALID_ARGUMENT");
  });
});
