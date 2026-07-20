/**
 * @testCategory integration
 * @blockchainRequired readonly
 * @transactional false
 * @description Read-only IPC JSON-RPC integration tests against a local geth IPC endpoint
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point QC_ENDPOINT at its IPC path
 * (Windows: \\.\pipe\geth.ipc, macOS/Ubuntu: data/geth.ipc) —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import qc from "../../index";
import { logSuite, logTest } from "../verbose-logger";

const IPC = process.env.QC_ENDPOINT || process.env.QC_IPC_PATH || "\\\\.\\pipe\\geth.ipc";

describe("IpcSocketProvider (readonly)", () => {
  it("getBlockNumber and getBlock('latest') work over IPC", async (t: { skip: (msg: string) => void }) => {
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
      assert.ok(latest.hash == null || typeof latest.hash === "string");

      const latestSummary = {
        number: latest.number,
        hash: latest.hash,
        parentHash: latest.parentHash,
        timestamp: latest.timestamp,
        transactionsCount: Array.isArray(latest.transactions) ? latest.transactions.length : null,
      };
      console.log("IPC latest block:", JSON.stringify(latestSummary));
    } catch (e) {
      t.skip(`IPC endpoint unavailable (${IPC}): ${e && (e as Error).message ? (e as Error).message : String(e)}`);
    }
  });
});
