/**
 * E2E test helpers.
 *
 * Resolves the JSON-RPC URL (QC_ENDPOINT / QC_RPC_URL / --rpc*) and chain id
 * (QC_CHAIN_ID, default 123123) for e2e tests, and compiles Solidity fixtures
 * with the JS-based @quantumcoin/solc compiler (no external solc install needed).
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point the
 * endpoint env vars at it —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 */

const fs = require("node:fs");
const path = require("node:path");
const { isVerbose, log } = require("../verbose-logger");

function getArg(name) {
  const prefix = name + "=";
  for (const a of process.argv) {
    if (a === name) return true;
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return null;
}

function getRpcUrl() {
  return (
    process.env.QC_ENDPOINT ||
    process.env.QC_RPC_URL ||
    getArg("--rpc") ||
    getArg("--rpcUrl") ||
    getArg("--rpc-url") ||
    null
  );
}

function getChainId() {
  const v = process.env.QC_CHAIN_ID || getArg("--chainId") || getArg("--chain-id");
  return v ? Number(v) : 123123;
}

/**
 * Compiles Solidity source file(s) with @quantumcoin/solc (JS/WASM compiler).
 *
 * @param {object} opts
 * @param {string|string[]} opts.solPaths - path(s) to .sol files
 * @param {string} [opts.contractName] - if set, only return this contract (throws when missing)
 * @returns {{ contractName: string, abi: any[], bin: string }[]} deployable artifacts (bin is 0x-prefixed)
 */
function compileSol({ solPaths, contractName }) {
  // Lazy require: loads the ~23MB WASM compiler only when a test actually compiles.
  const solc = require("@quantumcoin/solc");
  const paths = Array.isArray(solPaths) ? solPaths : [solPaths];
  const sources = {};
  for (const p of paths) {
    sources[path.basename(p)] = { content: fs.readFileSync(p, "utf8") };
  }
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      "@quantumcoin/solc compilation failed:\n" + errors.map((e) => e.formattedMessage || e.message).join("\n"),
    );
  }
  const artifacts = [];
  for (const file of Object.keys(output.contracts || {})) {
    for (const name of Object.keys(output.contracts[file])) {
      if (contractName && name !== contractName) continue;
      const c = output.contracts[file][name];
      const bin = c && c.evm && c.evm.bytecode && c.evm.bytecode.object ? c.evm.bytecode.object : "";
      if (!bin) continue; // skip interfaces/abstract contracts
      artifacts.push({ contractName: name, abi: c.abi, bin: bin.startsWith("0x") ? bin : "0x" + bin });
    }
  }
  if (artifacts.length === 0) {
    throw new Error(
      contractName
        ? `Contract ${contractName} not found in @quantumcoin/solc output (or has empty bytecode)`
        : "No deployable contracts found in @quantumcoin/solc output (empty bytecode).",
    );
  }
  artifacts.sort((a, b) => a.contractName.localeCompare(b.contractName));
  return artifacts;
}

function logE2eConfig() {
  if (!isVerbose()) return;
  log("e2e", "config", {
    rpcUrl: getRpcUrl() ? "(set)" : null,
    chainId: getChainId(),
    compiler: "@quantumcoin/solc",
  });
}

module.exports = {
  getRpcUrl,
  getChainId,
  compileSol,
  logE2eConfig,
};
