/**
 * @testCategory unit
 * @blockchainRequired false
 * @transactional false
 * @description ABI fragments + Interface (optional params, not-implemented stubs)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { Initialize } from "../../config";
import qc from "../../index";
import { logSuite, logTest } from "../verbose-logger";

describe("ABI fragments", () => {
  logSuite("ABI fragments");
  it("Fragment defaults inputs/outputs and format ignores optional format param", () => {
    logTest("Fragment defaults inputs/outputs and format ignores optional format param", {});
    const f = new qc.Fragment({ type: "function", name: "foo" });
    assert.deepEqual(f.inputs, []);
    assert.deepEqual(f.outputs, []);
    assert.equal(typeof f.format(), "string");
    assert.equal(typeof f.format("full"), "string");
    assert.equal(f.format(null), f.format());
  });
});

describe("Interface", () => {
  logSuite("Interface");
  it("constructor accepts null ABI and format ignores optional format param", () => {
    logTest("constructor accepts null ABI and format ignores optional format param", {});
    const i1 = new qc.Interface(null);
    assert.equal(i1.formatJson(), "[]");
    assert.equal(i1.format(), "[]");
    assert.equal(i1.format("full"), "[]");
    assert.equal(i1.format(null), "[]");
  });

  it("getFunction/getEvent/getError/getConstructor behave as expected", () => {
    const abi = [
      { type: "function", name: "foo", inputs: [], outputs: [] },
      { type: "event", name: "E", inputs: [], anonymous: false },
      { type: "error", name: "Bad", inputs: [] },
      { type: "constructor", inputs: [{ name: "x", type: "uint256" }] },
    ];
    const iface = new qc.Interface(abi);
    assert.ok(iface.getFunction("foo") instanceof qc.FunctionFragment);
    assert.ok(iface.getEvent("E") instanceof qc.EventFragment);
    assert.ok(iface.getError("Bad") instanceof qc.ErrorFragment);
    assert.ok(iface.getConstructor() instanceof qc.ConstructorFragment);
    assert.throws(() => iface.getFunction("missing"));
  });

  it("encodeFunctionData accepts values omitted vs null vs [] for zero-arg functions", async () => {
    await Initialize(null);
    const abi = [{ type: "function", name: "foo", inputs: [], outputs: [] }];
    const iface = new qc.Interface(abi);

    const a = iface.encodeFunctionData("foo");
    const b = iface.encodeFunctionData("foo", null);
    const c = iface.encodeFunctionData("foo", []);
    const d = iface.encodeFunctionData(iface.getFunction("foo"), []);

    assert.equal(typeof a, "string");
    assert.ok(a.startsWith("0x"));
    assert.equal(a, b);
    assert.equal(a, c);
    assert.equal(a, d);
  });

  it("encodeEventLog accepts values omitted vs null vs [] for zero-arg events", async () => {
    await Initialize(null);
    const abi = [{ type: "event", name: "E", inputs: [], anonymous: false }];
    const iface = new qc.Interface(abi);

    const a = iface.encodeEventLog("E");
    const b = iface.encodeEventLog("E", null);
    const c = iface.encodeEventLog("E", []);

    assert.ok(a && Array.isArray(a.topics));
    assert.equal(typeof a.data, "string");
    assert.deepEqual(a, b);
    assert.deepEqual(a, c);
  });

  it("getFunction resolves by name, signature, and 4-byte selector", async () => {
    await Initialize(null);
    const abi = [
      { type: "function", name: "transfer", stateMutability: "nonpayable",
        inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
    ];
    const iface = new qc.Interface(abi);
    const sel = iface.getSighash("transfer");
    assert.equal(sel, "0xa9059cbb"); // matches Ethereum: selectors are signature-only
    assert.equal(iface.getFunction("transfer").name, "transfer");
    assert.equal(iface.getFunction("transfer(address,uint256)").name, "transfer");
    assert.equal(iface.getFunction(sel).name, "transfer");
    assert.equal(iface.getFunction("transfer").selector, "0xa9059cbb");
    assert.throws(() => iface.getFunction("0xdeadbeef"), (e: Error & { code?: string }) => e && e.code === "INVALID_ARGUMENT");
  });

  it("getFunction throws on ambiguous overloaded name; resolves by signature", async () => {
    await Initialize(null);
    const abi = [
      { type: "function", name: "foo", inputs: [{ name: "a", type: "uint256" }], outputs: [] },
      { type: "function", name: "foo", inputs: [{ name: "a", type: "address" }], outputs: [] },
    ];
    const iface = new qc.Interface(abi);
    assert.throws(() => iface.getFunction("foo"), (e: Error & { code?: string }) => e && e.code === "INVALID_ARGUMENT");
    assert.equal(iface.getFunction("foo(address)").inputs[0].type, "address");
  });

  it("encodeFunctionData/decodeFunctionData round-trip (32-byte address)", async () => {
    await Initialize(null);
    const abi = [
      { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
    ];
    const iface = new qc.Interface(abi);
    const to = "0x" + "ab".repeat(32);
    const data = iface.encodeFunctionData("transfer", [to, 1000n]);
    assert.ok(data.startsWith("0xa9059cbb"));
    const decoded = iface.decodeFunctionData("transfer", data);
    assert.equal(decoded.to, to);
    assert.equal(decoded.amount, 1000n);
    assert.equal(decoded[0], to);
    assert.equal(decoded[1], 1000n);
    const re = iface.encodeFunctionData(iface.getFunction("transfer"), Array.from(decoded));
    assert.equal(re.toLowerCase(), data.toLowerCase());
  });

  it("decodeFunctionData throws when the selector does not match", async () => {
    await Initialize(null);
    const abi = [
      { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
      { type: "function", name: "foo", inputs: [], outputs: [] },
    ];
    const iface = new qc.Interface(abi);
    const data = iface.encodeFunctionData("transfer", ["0x" + "11".repeat(32), 1n]);
    assert.throws(() => iface.decodeFunctionData("foo", data), (e: Error & { code?: string }) => e && e.code === "INVALID_ARGUMENT");
  });

  it("parseTransaction returns fragment/name/signature/selector/args/value", async () => {
    await Initialize(null);
    const abi = [
      { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
    ];
    const iface = new qc.Interface(abi);
    const to = "0x" + "22".repeat(32);
    const data = iface.encodeFunctionData("transfer", [to, 7n]);
    const parsed = iface.parseTransaction({ data, value: "0x0a" });
    assert.equal(parsed.name, "transfer");
    assert.equal(parsed.signature, "transfer(address,uint256)");
    assert.equal(parsed.selector, "0xa9059cbb");
    assert.equal(parsed.args.to, to);
    assert.equal(parsed.args.amount, 7n);
    assert.equal(parsed.value, 10n);
    assert.ok(parsed.fragment instanceof qc.FunctionFragment);
  });

  it("parseTransaction rejects unknown selector and short data", async () => {
    await Initialize(null);
    const iface = new qc.Interface([{ type: "function", name: "foo", inputs: [], outputs: [] }]);
    assert.throws(() => iface.parseTransaction({ data: "0xdeadbeef" }), (e: Error & { code?: string }) => e && e.code === "INVALID_ARGUMENT");
    assert.throws(() => iface.parseTransaction({ data: "0x00" }), (e: Error & { code?: string }) => e && e.code === "INVALID_ARGUMENT");
  });

  it("parseError decodes a custom error by selector", async () => {
    await Initialize(null);
    const errInputs = [{ name: "have", type: "uint256" }, { name: "want", type: "uint256" }];
    const iface = new qc.Interface([{ type: "error", name: "InsufficientBalance", inputs: errInputs }]);
    const data = new qc.Interface([{ type: "function", name: "InsufficientBalance", inputs: errInputs, outputs: [] }])
      .encodeFunctionData("InsufficientBalance", [5n, 10n]);
    const pe = iface.parseError(data);
    assert.equal(pe.name, "InsufficientBalance");
    assert.equal(pe.args.have, 5n);
    assert.equal(pe.args.want, 10n);
    assert.equal(pe.selector, iface.getError("InsufficientBalance").selector);
    assert.throws(() => iface.parseError("0xdeadbeef"), (e: Error & { code?: string }) => e && e.code === "INVALID_ARGUMENT");
  });

  it("getEvent resolves by name, signature, and topic0; topicHash matches", async () => {
    await Initialize(null);
    const abi = [
      { type: "event", name: "Transfer", anonymous: false, inputs: [
        { name: "from", type: "address", indexed: true },
        { name: "to", type: "address", indexed: true },
        { name: "value", type: "uint256", indexed: false }] },
    ];
    const iface = new qc.Interface(abi);
    const topic = iface.getEventTopic("Transfer");
    assert.equal(iface.getEvent("Transfer").name, "Transfer");
    assert.equal(iface.getEvent("Transfer(address,address,uint256)").name, "Transfer");
    assert.equal(iface.getEvent(topic).name, "Transfer");
    assert.equal(iface.getEvent("Transfer").topicHash, topic);
  });

  it("encodeDeploy encodes constructor args (0x when none)", async () => {
    await Initialize(null);
    const owner = "0x" + "33".repeat(32);
    const iface = new qc.Interface([
      { type: "constructor", inputs: [{ name: "owner", type: "address" }, { name: "cap", type: "uint256" }] },
    ]);
    const enc = iface.encodeDeploy([owner, 42n]);
    const full = new qc.Interface([{ type: "function", name: "c", inputs: [{ name: "owner", type: "address" }, { name: "cap", type: "uint256" }], outputs: [] }])
      .encodeFunctionData("c", [owner, 42n]);
    assert.equal(enc, "0x" + full.slice(10));
    assert.equal(new qc.Interface([{ type: "constructor", inputs: [] }]).encodeDeploy([]), "0x");
  });

  it("getFallback/getReceive return null", () => {
    const iface = new qc.Interface([]);
    assert.equal(iface.getFallback(), null);
    assert.equal(iface.getReceive(), null);
  });

  it("getEventTopic returns the event signature hash", () => {
    const iface = new qc.Interface([
      { type: "event", name: "E", anonymous: false, inputs: [{ name: "x", type: "uint256", indexed: false }] },
    ]);
    assert.match(iface.getEventTopic("E"), /^0x[0-9a-f]{64}$/);
    assert.throws(() => iface.getEventTopic("Nope"), (e: Error & { code?: string }) => e && e.code === "INVALID_ARGUMENT");
  });
});

describe("AbiCoder", () => {
  it("getDefaultValue returns array of nulls", () => {
    const coder = new qc.AbiCoder();
    assert.deepEqual(coder.getDefaultValue(["uint256", "bool"]), [null, null]);
  });

  it("defaultAbiCoder() returns a shared singleton and round-trips values", async () => {
    await Initialize(null);
    const coder = qc.AbiCoder.defaultAbiCoder();
    assert.ok(coder instanceof qc.AbiCoder);
    assert.equal(coder, qc.AbiCoder.defaultAbiCoder());
    const encoded = coder.encode(["uint256", "bool"], [123n, true]);
    const decoded = coder.decode(["uint256", "bool"], encoded);
    assert.equal(decoded[0], 123n);
    assert.equal(decoded[1], true);
  });
});
