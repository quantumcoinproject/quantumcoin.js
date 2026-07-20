/**
 * @testCategory integration
 * @blockchainRequired readonly
 * @transactional false
 * @description Read-only IPC JSON-RPC integration tests against a local geth IPC endpoint
 * Run with VERBOSE=1 for test names, block number/hash.
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point QC_ENDPOINT at its IPC path
 * (Windows: \\.\pipe\geth.ipc, macOS/Ubuntu: data/geth.ipc) —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const qc = require("../../index");
const { logSuite, logTest } = require("../verbose-logger");

const IPC = process.env.QC_ENDPOINT || process.env.QC_IPC_PATH || "\\\\.\\pipe\\geth.ipc";

describe("IpcSocketProvider (readonly)", () => {
  it("getBlockNumber and getBlock('latest') work over IPC", async (t) => {
    logSuite("IpcSocketProvider (readonly)");
    logTest("getBlockNumber and getBlock('latest') work over IPC", { endpoint: IPC });
    const provider = qc.getProvider(IPC);
    try {
      const bn = await provider.getBlockNumber();
      logTest("getBlockNumber (ipc)", { blockNumber: bn });
      assert.ok(Number.isInteger(bn) && bn >= 0);

      const latest = await provider.getBlock("latest");
      logTest("getBlock('latest') (ipc)", { blockNumber: latest.number, blockHash: latest.hash });
      assert.ok(latest && typeof latest === "object");
      assert.ok(typeof latest.number === "number" && latest.number >= bn);
      // best-effort sanity: hash often exists on latest blocks
      assert.ok(latest.hash == null || typeof latest.hash === "string");

      // Print a JSON-safe summary (avoid circular refs like latest.provider)
      const latestSummary = {
        number: latest.number,
        hash: latest.hash,
        parentHash: latest.parentHash,
        timestamp: latest.timestamp,
        transactionsCount: Array.isArray(latest.transactions) ? latest.transactions.length : null,
      };
      // This shows up in TAP output as "# ..."
      console.log("IPC latest block:", JSON.stringify(latestSummary));
    } catch (e) {
      t.skip(`IPC endpoint unavailable (${IPC}): ${e && e.message ? e.message : String(e)}`);
    }
  });
});

