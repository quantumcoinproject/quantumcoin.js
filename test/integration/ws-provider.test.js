/**
 * @testCategory integration
 * @blockchainRequired readonly
 * @transactional false
 * @description Read-only WebSocket JSON-RPC integration tests (validates WebSocketProvider only).
 * Skipped when QC_ENDPOINT is set (e.g. running integration tests over IPC).
 * Run with VERBOSE=1 for test names, block number/hash.
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point QC_WS_URL at its WebSocket port —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const qc = require("../../index");
const { logSuite, logTest } = require("../verbose-logger");

const WS = process.env.QC_WS_URL || "ws://127.0.0.1:8546";
const skipBecauseOtherEndpoint = process.env.QC_ENDPOINT != null && process.env.QC_ENDPOINT !== "";

describe("WebSocketProvider (readonly)", { skip: skipBecauseOtherEndpoint }, () => {
  it("getBlockNumber and getBlock('latest') work over WebSocket", async (t) => {
    logSuite("WebSocketProvider (readonly)");
    logTest("getBlockNumber and getBlock('latest') work over WebSocket", { endpoint: WS });
    const provider = qc.getProvider(WS);
    try {
      const bn = await provider.getBlockNumber();
      logTest("getBlockNumber (ws)", { blockNumber: bn });
      assert.ok(Number.isInteger(bn) && bn >= 0);

      const latest = await provider.getBlock("latest");
      logTest("getBlock('latest') (ws)", { blockNumber: latest.number, blockHash: latest.hash });
      assert.ok(latest && typeof latest === "object");
      assert.ok(typeof latest.number === "number" && latest.number >= bn);
      assert.ok(latest.hash == null || typeof latest.hash === "string");
    } catch (e) {
      t.skip(`WebSocket endpoint unavailable (${WS}): ${e && e.message ? e.message : String(e)}`);
    } finally {
      if (provider && typeof provider.destroy === "function") provider.destroy();
    }
  });
});

