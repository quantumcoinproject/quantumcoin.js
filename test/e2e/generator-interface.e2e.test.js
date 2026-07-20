/**
 * @testCategory e2e
 * @blockchainRequired write
 * @transactional true
 * @description Real-chain e2e test verifying the generator skips the bytecode
 *              validation for interface contracts. Materializes a tiny interface
 *              SDK to a tmpdir and runs the generator's emitted `node --test`
 *              file against the real QC_RPC_URL chain with the real test wallet.
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point QC_RPC_URL at it —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { generateFromArtifacts, generateTransactionalTestJs } = require("../../src/generator");
const { getRpcUrl, getChainId, logE2eConfig } = require("./helpers");
const { logSuite, logTest } = require("../verbose-logger");

function _materializeInterfaceSdk({ contractName, abi, bytecode }) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-iface-e2e-"));
  const srcDir = path.join(tmpRoot, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  generateFromArtifacts({
    outDir: srcDir,
    artifacts: [{ contractName, abi, bytecode }],
    lang: "js",
  });

  fs.writeFileSync(
    path.join(tmpRoot, "index.js"),
    `module.exports = require("./src");\n`,
  );
  fs.writeFileSync(
    path.join(tmpRoot, "package.json"),
    JSON.stringify(
      { name: `qcgen-iface-${Date.now()}`, version: "0.0.1", main: "index.js", private: true },
      null,
      2,
    ),
  );

  const repoRoot = path.resolve(__dirname, "..", "..");
  const qcShim = path.join(tmpRoot, "node_modules", "quantumcoin");
  fs.mkdirSync(qcShim, { recursive: true });
  fs.writeFileSync(
    path.join(qcShim, "package.json"),
    JSON.stringify(
      { name: "quantumcoin", version: "0.0.0", main: "index.js", private: true },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(qcShim, "index.js"),
    `module.exports = require(${JSON.stringify(path.join(repoRoot, "index.js"))});\n`,
  );
  fs.writeFileSync(
    path.join(qcShim, "config.js"),
    `module.exports = require(${JSON.stringify(path.join(repoRoot, "config.js"))});\n`,
  );

  const testFile = path.join(tmpRoot, "test", "e2e", `${contractName}.e2e.test.js`);
  fs.mkdirSync(path.dirname(testFile), { recursive: true });
  fs.writeFileSync(
    testFile,
    generateTransactionalTestJs({ contractName, abi, bytecode }),
  );

  return { tmpRoot, testFile };
}

describe("auto-generator: interface contract end-to-end (real chain)", () => {
  logSuite("auto-generator: interface contract end-to-end (real chain)");

  it("generated interface test runs against the real chain and passes (bytecode check skipped)", async (t) => {
    logTest("generated interface test runs against the real chain and passes", {});
    const rpcUrl = getRpcUrl();
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }
    logE2eConfig();
    const chainId = getChainId();

    const contractName = "IThing";
    const abi = [
      {
        type: "function",
        name: "doThing",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ];
    const bytecode = "0x";

    const { tmpRoot, testFile } = _materializeInterfaceSdk({ contractName, abi, bytecode });

    // Sanity: the generator should not have emitted a bytecode assertion for this interface.
    const generatedSrc = fs.readFileSync(testFile, "utf8");
    assert.ok(
      !/provider\.getCode\(contract\.target/.test(generatedSrc),
      "interface-generated test must not contain provider.getCode bytecode assertion",
    );
    assert.ok(
      /Skipping bytecode check/.test(generatedSrc),
      "interface-generated test must contain the skip-comment marker",
    );

    // IMPORTANT: scrub Node's internal --test child-context markers from the
    // spawn env. The outer `node --test` runner sets NODE_TEST_CONTEXT (and
    // related vars) which would make our spawned child short-circuit as a
    // "test child" instead of running the generated test normally.
    const childEnv = { ...process.env, QC_RPC_URL: rpcUrl, QC_CHAIN_ID: String(chainId) };
    delete childEnv.NODE_TEST_CONTEXT;
    delete childEnv.NODE_TEST_OPTIONS;
    if (childEnv.NODE_OPTIONS && /--test\b/.test(childEnv.NODE_OPTIONS)) {
      childEnv.NODE_OPTIONS = childEnv.NODE_OPTIONS.replace(/(^|\s)--test\b\S*/g, "").trim();
    }

    let succeeded = false;
    try {
      const res = spawnSync(
        process.execPath,
        ["--test", "--test-reporter=tap", testFile],
        {
          cwd: tmpRoot,
          env: childEnv,
          encoding: "utf8",
          shell: false,
          windowsHide: true,
        },
      );
      assert.equal(
        res.status,
        0,
        `generated interface test failed:\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`,
      );
      // Accept either the TAP reporter ("# pass 1") or the spec reporter
      // ("\u2139 pass 1") summary line so the assertion is reporter-agnostic.
      assert.match(
        res.stdout || "",
        /(?:#|\u2139)\s*pass 1\b/,
        `generated interface test did not actually run (no 'pass 1' summary in test output);\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`,
      );
      assert.doesNotMatch(
        res.stdout || "",
        /(?:#|\u2139)\s*pass 0\b|(?:#|\u2139)\s*tests 0\b|(?:#|\u2139)\s*skipped 1\b/,
        `generated interface test was skipped or did not run any tests;\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`,
      );
      succeeded = true;
    } finally {
      if (succeeded) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } else {
        // eslint-disable-next-line no-console
        console.error("Generated interface package kept at:", tmpRoot);
      }
    }
  }, { timeout: 1_800_000 });
});
