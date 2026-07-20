/**
 * @testCategory e2e
 * @blockchainRequired write
 * @transactional true
 *
 * End-to-end test for the typed contract generator:
 * - Compiles a Solidity contract with a constructor parameter
 * - Generates a standalone typed-contract package into a temp folder
 * - Runs `npm install`
 * - Verifies tests/examples were generated
 * - Runs the generated package tests against the provided JSON-RPC URL
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point QC_RPC_URL at it —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 *
 * Solidity is compiled in-process with the JS-based @quantumcoin/solc package
 * (https://www.npmjs.com/package/@quantumcoin/solc); no external solc install is needed.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const { getRpcUrl, getChainId, compileSol, logE2eConfig } = require("./helpers");
const { logSuite, logTest } = require("../verbose-logger");

function getNpmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(cmd, args, cwd, env) {
  const res = spawnSync(cmd, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
    windowsHide: true,
  });
  if (res.error) throw res.error;
  return res;
}

function _quoteIfNeeded(s) {
  if (typeof s !== "string") return s;
  return /[ \t"]/g.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

function runNpm(args, cwd, env) {
  if (process.platform === "win32") {
    const cmd = `${getNpmCmd()} ${args.map(_quoteIfNeeded).join(" ")}`;
    return run("cmd.exe", ["/d", "/s", "/c", cmd], cwd, env);
  }
  return run(getNpmCmd(), args, cwd, env);
}

function compileSolidity({ solPath, contractName }) {
  const [artifact] = compileSol({ solPaths: solPath, contractName });
  return { abi: artifact.abi, bin: artifact.bin };
}

// Runs a read-only `npm audit` on the generated SDK and fails the test only when
// actual vulnerabilities are reported. We never auto-fix/auto-approve anything:
// npm's non-zero exit code and unrelated warnings (install-scripts, funding, notices)
// are ignored; the pass/fail decision comes solely from the parsed JSON report.
function assertNpmAuditClean(pkgRoot, label, env) {
  if (!fs.existsSync(path.join(pkgRoot, "node_modules"))) {
    const install = runNpm(["install", "--no-fund", "--no-audit"], pkgRoot, env);
    assert.equal(install.status, 0, `${label}: npm install (for audit) failed:\n${install.stdout}\n${install.stderr}`);
  }
  const res = runNpm(["audit", "--json"], pkgRoot, env);
  let report;
  try {
    report = JSON.parse(res.stdout);
  } catch (err) {
    assert.fail(`${label}: could not parse 'npm audit --json' output:\n${res.stdout}\n${res.stderr}`);
  }
  const vulns = (report && report.metadata && report.metadata.vulnerabilities) || {};
  const total =
    typeof vulns.total === "number"
      ? vulns.total
      : ["info", "low", "moderate", "high", "critical"].reduce((sum, k) => sum + (Number(vulns[k]) || 0), 0);
  assert.equal(total, 0, `${label}: npm audit reported ${total} vulnerability(ies):\n${JSON.stringify(report.vulnerabilities || {}, null, 2)}`);
}

describe("typed contract generator package e2e", () => {
  it("generates a package and runs its transactional tests", async (t) => {
    logSuite("typed contract generator package e2e");
    logTest("generates a package and runs its transactional tests", {});
    const rpcUrl = getRpcUrl();
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }
    logE2eConfig();
    const chainId = getChainId();

    const repoRoot = path.resolve(__dirname, "..", "..");
    const fixtureSol = path.join(repoRoot, "test", "fixtures", "ConstructorParam.sol");
    const contractName = "ConstructorParam";

    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-"));
    const pkgName = `qcgen-${Date.now()}`;
    const pkgDir = tmpBase;
    const pkgRoot = path.join(pkgDir, pkgName);

    let succeeded = false;
    try {
      // 1) Compile fixture to ABI + BIN
      const { abi, bin } = compileSolidity({ solPath: fixtureSol, contractName });

      const abiPath = path.join(tmpBase, `${contractName}.abi.json`);
      const binPath = path.join(tmpBase, `${contractName}.bin`);
      fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2), "utf8");
      fs.writeFileSync(binPath, bin.trim().startsWith("0x") ? bin.trim() : `0x${bin.trim()}`, "utf8");

      // 2) Generate package
      const generatorCli = path.join(repoRoot, "generate-sdk.js");
      const gen = run(
        process.execPath,
        [
          generatorCli,
          "--abi",
          abiPath,
          "--bin",
          binPath,
          "--name",
          contractName,
          "--create-package",
          "--package-dir",
          pkgDir,
          "--package-name",
          pkgName,
          "--package-description",
          "Temporary typed-contract package generated by quantumcoin.js e2e tests",
          "--package-author",
          "quantumcoin.js test",
          "--package-license",
          "MIT",
          "--package-version",
          "0.0.1",
          "--non-interactive",
        ],
        repoRoot,
        process.env,
      );
      assert.equal(gen.status, 0, `generator failed:\n${gen.stdout}\n${gen.stderr}`);

      // 3) Verify expected files exist
      assert.ok(fs.existsSync(path.join(pkgRoot, "package.json")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "tsconfig.json")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", `${contractName}.ts`)));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", `${contractName}__factory.ts`)));
      assert.ok(fs.existsSync(path.join(pkgRoot, "test", "e2e", `${contractName}.e2e.test.js`)));
      assert.ok(fs.existsSync(path.join(pkgRoot, "examples", "deploy.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "examples", "read-operations.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "examples", "write-operations.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "examples", "events.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "index.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "index.d.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "README.md")));

      // This test uses ABI+BIN input, so Solidity source comments are not available here.
      // Ensure the doc build ran and included the contract name.
      const readme = fs.readFileSync(path.join(pkgRoot, "README.md"), "utf8");
      assert.ok(readme.includes(contractName));

      // 4) Install deps (generator runs install+build, but keep this idempotent)
      if (!fs.existsSync(path.join(pkgRoot, "node_modules"))) {
        const install = runNpm(["install", "--no-fund", "--no-audit"], pkgRoot, process.env);
        assert.equal(install.status, 0, `npm install failed:\n${install.stdout}\n${install.stderr}`);
      }

      // 5) Run generated tests against the configured chain
      assertNpmAuditClean(pkgRoot, "generated package", process.env);

      const env = {
        ...process.env,
        QC_RPC_URL: rpcUrl,
        QC_CHAIN_ID: String(chainId),
      };
      const testRun = runNpm(["test"], pkgRoot, env);
      assert.equal(testRun.status, 0, `generated package tests failed:\n${testRun.stdout}\n${testRun.stderr}`);

      succeeded = true;
    } finally {
      // Keep artifacts on failure for debugging.
      if (succeeded) {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      } else {
        // eslint-disable-next-line no-console
        console.error("Generated package kept at:", pkgRoot);
      }
    }
  }, { timeout: 1_800_000 });

  it("generates a package from artifacts JSON input (multiple contracts) and runs its transactional tests", async (t) => {
    const rpcUrl = getRpcUrl();
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }

    const chainId = getChainId();

    const repoRoot = path.resolve(__dirname, "..", "..");
    const fixtureCtorSol = path.join(repoRoot, "test", "fixtures", "ConstructorParam.sol");
    const fixtureMultiSol = path.join(repoRoot, "test", "fixtures", "MultiContracts.sol");

    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-json-"));
    const pkgName = `qcgen-json-${Date.now()}`;
    const pkgDir = tmpBase;
    const pkgRoot = path.join(pkgDir, pkgName);

    let succeeded = false;
    try {
      // Compile 2 contracts into ABI+BIN pairs
      const ctorName = "ConstructorParam";
      const alphaName = "Alpha";

      const { abi: ctorAbi, bin: ctorBin } = compileSolidity({ solPath: fixtureCtorSol, contractName: ctorName });
      const { abi: alphaAbi, bin: alphaBin } = compileSolidity({ solPath: fixtureMultiSol, contractName: alphaName });

      const ctorAbiPath = path.join(tmpBase, `${ctorName}.abi.json`);
      const ctorBinPath = path.join(tmpBase, `${ctorName}.bin`);
      fs.writeFileSync(ctorAbiPath, JSON.stringify(ctorAbi, null, 2), "utf8");
      fs.writeFileSync(ctorBinPath, ctorBin.trim().startsWith("0x") ? ctorBin.trim() : `0x${ctorBin.trim()}`, "utf8");

      const alphaAbiPath = path.join(tmpBase, `${alphaName}.abi.json`);
      const alphaBinPath = path.join(tmpBase, `${alphaName}.bin`);
      fs.writeFileSync(alphaAbiPath, JSON.stringify(alphaAbi, null, 2), "utf8");
      fs.writeFileSync(alphaBinPath, alphaBin.trim().startsWith("0x") ? alphaBin.trim() : `0x${alphaBin.trim()}`, "utf8");

      const artifactsJsonPath = path.join(tmpBase, "artifacts.json");
      fs.writeFileSync(
        artifactsJsonPath,
        JSON.stringify(
          [
            { abi: path.basename(alphaAbiPath), bin: path.basename(alphaBinPath) },
            { abi: path.basename(ctorAbiPath), bin: path.basename(ctorBinPath) },
          ],
          null,
          2,
        ),
        "utf8",
      );

      // Generate package using artifacts JSON input
      const generatorCli = path.join(repoRoot, "generate-sdk.js");
      const gen = run(
        process.execPath,
        [
          generatorCli,
          "--artifacts-json",
          artifactsJsonPath,
          "--create-package",
          "--package-dir",
          pkgDir,
          "--package-name",
          pkgName,
          "--package-description",
          "Temporary typed-contract package generated from artifacts JSON input",
          "--package-author",
          "quantumcoin.js test",
          "--package-license",
          "MIT",
          "--package-version",
          "0.0.1",
          "--non-interactive",
        ],
        repoRoot,
        process.env,
      );
      assert.equal(gen.status, 0, `generator failed:\n${gen.stdout}\n${gen.stderr}`);

      // Verify multiple contracts were generated
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "Alpha.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "Alpha__factory.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "ConstructorParam.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "ConstructorParam__factory.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "index.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "index.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "index.d.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "README.md")));

      // Verify tests exist for each contract
      assert.ok(fs.existsSync(path.join(pkgRoot, "test", "e2e", "Alpha.e2e.test.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "test", "e2e", "ConstructorParam.e2e.test.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "test", "e2e", "all-contracts.e2e.test.js")));

      // Multi-contract packages use per-contract example filenames.
      assert.ok(fs.existsSync(path.join(pkgRoot, "examples", "deploy-Alpha.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "examples", "deploy-ConstructorParam.js")));

      const readme = fs.readFileSync(path.join(pkgRoot, "README.md"), "utf8");
      assert.ok(readme.includes("Alpha"));
      assert.ok(readme.includes("ConstructorParam"));

      // Install deps + run tests against chain
      if (!fs.existsSync(path.join(pkgRoot, "node_modules"))) {
        const install = runNpm(["install", "--no-fund", "--no-audit"], pkgRoot, process.env);
        assert.equal(install.status, 0, `npm install failed:\n${install.stdout}\n${install.stderr}`);
      }

      assertNpmAuditClean(pkgRoot, "generated package", process.env);

      const env = {
        ...process.env,
        QC_RPC_URL: rpcUrl,
        QC_CHAIN_ID: String(chainId),
      };
      const testRun = runNpm(["test"], pkgRoot, env);
      assert.equal(testRun.status, 0, `generated package tests failed:\n${testRun.stdout}\n${testRun.stderr}`);

      succeeded = true;
    } finally {
      if (succeeded) {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      } else {
        // eslint-disable-next-line no-console
        console.error("Generated package kept at:", pkgRoot);
      }
    }
  }, { timeout: 1_800_000 });

  it("generates a package from Solidity input (multiple contracts) and runs its transactional tests", async (t) => {
    const rpcUrl = getRpcUrl();
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }

    const chainId = getChainId();

    const repoRoot = path.resolve(__dirname, "..", "..");
    const fixtureSol = path.join(repoRoot, "test", "fixtures", "MultiContracts.sol");

    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-sol-"));
    const pkgName = `qcgen-sol-${Date.now()}`;
    const pkgDir = tmpBase;
    const pkgRoot = path.join(pkgDir, pkgName);

    let succeeded = false;
    try {
      // Generate package directly from Solidity sources
      const generatorCli = path.join(repoRoot, "generate-sdk.js");
      const gen = run(
        process.execPath,
        [
          generatorCli,
          "--sol",
          fixtureSol,
          "--create-package",
          "--package-dir",
          pkgDir,
          "--package-name",
          pkgName,
          "--package-description",
          "Temporary typed-contract package generated from Solidity input",
          "--package-author",
          "quantumcoin.js test",
          "--package-license",
          "MIT",
          "--package-version",
          "0.0.1",
          "--non-interactive",
        ],
        repoRoot,
        process.env,
      );
      assert.equal(gen.status, 0, `generator failed:\n${gen.stdout}\n${gen.stderr}`);

      // Verify multiple contracts were generated
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "Alpha.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "Alpha__factory.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "Beta.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "Beta__factory.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "src", "index.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "index.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "index.d.ts")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "README.md")));

      // Verify artifacts were emitted
      assert.ok(fs.existsSync(path.join(pkgRoot, "artifacts", "Alpha.abi.json")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "artifacts", "Alpha.bin")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "artifacts", "Beta.abi.json")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "artifacts", "Beta.bin")));

      // Verify tests exist for each contract
      assert.ok(fs.existsSync(path.join(pkgRoot, "test", "e2e", "Alpha.e2e.test.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "test", "e2e", "Beta.e2e.test.js")));
      assert.ok(fs.existsSync(path.join(pkgRoot, "test", "e2e", "all-contracts.e2e.test.js")));

      // Verify Solidity comments were propagated into generated TS
      const alphaTs = fs.readFileSync(path.join(pkgRoot, "src", "Alpha.ts"), "utf8");
      assert.ok(alphaTs.includes("Alpha contract for multi-contract generator test."));
      assert.ok(alphaTs.includes("Set a new value in Alpha."));

      // Install deps + run tests against chain
      if (!fs.existsSync(path.join(pkgRoot, "node_modules"))) {
        const install = runNpm(["install", "--no-fund", "--no-audit"], pkgRoot, process.env);
        assert.equal(install.status, 0, `npm install failed:\n${install.stdout}\n${install.stderr}`);
      }

      assertNpmAuditClean(pkgRoot, "generated package", process.env);

      const env = {
        ...process.env,
        QC_RPC_URL: rpcUrl,
        QC_CHAIN_ID: String(chainId),
      };
      const testRun = runNpm(["test"], pkgRoot, env);
      assert.equal(testRun.status, 0, `generated package tests failed:\n${testRun.stdout}\n${testRun.stderr}`);

      succeeded = true;
    } finally {
      if (succeeded) {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      } else {
        // eslint-disable-next-line no-console
        console.error("Generated package kept at:", pkgRoot);
      }
    }
  }, { timeout: 1_800_000 });
});

