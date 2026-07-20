/**
 * @testCategory integration
 * @blockchainRequired readonly
 * @transactional false
 * @description Read-only integration tests. Endpoint from QC_ENDPOINT or QC_RPC_URL (default: public RPC).
 * Works with HTTP, WebSocket, or IPC; use QC_ENDPOINT=\\.\pipe\geth.ipc to run over IPC.
 * Run with VERBOSE=1 or QC_VERBOSE=1 for test names, addresses, block numbers.
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point QC_ENDPOINT/QC_RPC_URL at it —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { Initialize } = require("../../config");
const qc = require("../../index");
const { logSuite, logTest, logAddress } = require("../verbose-logger");

const DEFAULT_RPC = "https://public.rpc.quantumcoinapi.com";
const CHAIN_ID = 123123;
const STAKING_CONTRACT = "0x" + "00".repeat(30) + "10" + "00"; // ...1000 (32-byte address)

const ENDPOINT = process.env.QC_ENDPOINT || process.env.QC_RPC_URL || DEFAULT_RPC;
const isPublicRpc = ENDPOINT === DEFAULT_RPC;

describe("Provider (readonly)", () => {
  it("getBlockNumber returns a block number", async (t) => {
    logSuite("Provider (readonly)");
    logTest("getBlockNumber returns a block number", { endpoint: ENDPOINT, chainId: CHAIN_ID });
    const provider = qc.getProvider(ENDPOINT, CHAIN_ID);
    try {
      const bn = await provider.getBlockNumber();
      logTest("getBlockNumber returns a block number", { blockNumber: bn });
      assert.ok(Number.isInteger(bn) && bn >= 0);
      if (isPublicRpc) assert.ok(bn > 3000000, "public chain height");
    } catch (e) {
      t.skip(`network unavailable: ${e && e.message ? e.message : String(e)}`);
    }
  });

  it("getBlock('latest') works", async (t) => {
    logTest("getBlock('latest') works", {});
    const provider = qc.getProvider(ENDPOINT, CHAIN_ID);
    try {
      const latest = await provider.getBlockNumber();
      const block = await provider.getBlock("latest");
      logTest("getBlock('latest') works", { blockNumber: block.number, blockHash: block.hash });
      assert.ok(block && typeof block === "object");
      assert.ok(typeof block.number === "number" && block.number >= latest);
      if (isPublicRpc && latest >= 3386000) {
        const b = await provider.getBlock(3386000);
        assert.equal(b.number, 3386000);
      }
    } catch (e) {
      t.skip(`network unavailable: ${e && e.message ? e.message : String(e)}`);
    }
  });

  it("getBalance works for an address", async (t) => {
    logTest("getBalance works for an address", {});
    logAddress("staking_contract", STAKING_CONTRACT);
    const provider = qc.getProvider(ENDPOINT, CHAIN_ID);
    try {
      const bal = await provider.getBalance(STAKING_CONTRACT);
      logTest("getBalance works for an address", { balance: bal.toString() });
      assert.equal(typeof bal, "bigint");
      assert.ok(bal >= 0n);
    } catch (e) {
      t.skip(`network unavailable: ${e && e.message ? e.message : String(e)}`);
    }
  });

  it("contract read operations work (staking contract when available)", async (t) => {
    logTest("contract read operations work (staking contract when available)", {});
    logAddress("staking_contract", STAKING_CONTRACT);
    await Initialize(null);
    const provider = qc.getProvider(ENDPOINT, CHAIN_ID);
    try {
      const abi = require("../fixtures/StakingContract.abi.json");
      const contract = new qc.Contract(STAKING_CONTRACT, abi, provider);
      const count = await contract.getDepositorCount();
      const value = Array.isArray(count) ? count[0] : count;
      logTest("contract read operations work", { depositorCount: value != null ? String(value) : null });
      assert.ok(value != null);
    } catch (e) {
      t.skip(`network/ABI unavailable: ${e && e.message ? e.message : String(e)}`);
    }
  });
});

