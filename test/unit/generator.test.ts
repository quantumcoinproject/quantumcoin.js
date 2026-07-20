/**
 * @testCategory unit
 * @blockchainRequired false
 * @transactional false
 * @description Typed contract generator (file output shape)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generate, generateFromArtifacts, generateTransactionalTestJs } from "../../src/generator";
import { logSuite, logTest } from "../verbose-logger";

describe("typed contract generator", () => {
  logSuite("typed contract generator");
  it("generates contract + factory + types + index files", () => {
    logTest("generates contract + factory + types + index files", {});
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-"));
    const abiPath = path.join(tmp, "Test.abi.json");
    const binPath = path.join(tmp, "Test.bin");
    const outDir = path.join(tmp, "out");

    const abi = [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
    ];

    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2), "utf8");
    fs.writeFileSync(binPath, "0x6000", "utf8");

    const res = generate({ abiPath, binPath, outDir, contractName: "TestToken" });
    assert.ok(fs.existsSync(res.contractFile));
    assert.ok(fs.existsSync(res.factoryFile));
    assert.ok(fs.existsSync(res.typesFile));
    assert.ok(fs.existsSync(res.indexFile));

    const contractSrc = fs.readFileSync(res.contractFile, "utf8");
    assert.ok(contractSrc.includes("export class TestToken"));
    assert.ok(contractSrc.includes("async balanceOf"));
    assert.ok(contractSrc.includes("async transfer"));
    assert.ok(contractSrc.includes("populateTransaction"));

    const factorySrc = fs.readFileSync(res.factoryFile, "utf8");
    assert.ok(factorySrc.includes("export class TestToken__factory"));
  });

  it("generated test for a concrete contract (with bytecode) contains the provider.getCode bytecode assertion", () => {
    logTest("generated test for a concrete contract contains the bytecode assertion", {});
    const src = generateTransactionalTestJs({
      contractName: "ConcreteToken",
      abi: [{ type: "constructor", inputs: [], stateMutability: "nonpayable" }],
      bytecode: "0x6080604052",
    });
    assert.ok(src.includes("provider.getCode(contract.target"));
    assert.ok(src.includes('assert.ok(code && code !== "0x")'));
    assert.ok(!src.includes("Skipping bytecode check"));
  });

  it("generated test for an interface (bytecode '0x') omits the provider.getCode bytecode assertion", () => {
    logTest("generated test for an interface omits the bytecode assertion", {});
    const src = generateTransactionalTestJs({
      contractName: "IThing",
      abi: [{
        type: "function", name: "doThing",
        inputs: [], outputs: [], stateMutability: "nonpayable",
      }],
      bytecode: "0x",
    });
    assert.ok(!src.includes("provider.getCode(contract.target"));
    assert.ok(!src.includes('assert.ok(code && code !== "0x")'));
    assert.ok(src.includes("Skipping bytecode check"));
    assert.ok(src.includes("IThing is an interface"));
  });

  it("empty/undefined/null/'0X' bytecode variants are all treated as interface", () => {
    logTest("empty bytecode variants are all treated as interface", {});
    for (const bc of [undefined, null, "", "0x", "0X", "  0x  "] as Array<string | null | undefined>) {
      const src = generateTransactionalTestJs({
        contractName: "IThing",
        abi: [],
        bytecode: bc as unknown as string,
      });
      assert.ok(
        !src.includes("provider.getCode(contract.target"),
        `bytecode=${JSON.stringify(bc)} should be treated as interface (no getCode assertion)`,
      );
      assert.ok(
        src.includes("Skipping bytecode check"),
        `bytecode=${JSON.stringify(bc)} should emit skip comment`,
      );
    }
  });

  it("includes injected docs in generated TypeScript", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-docs-"));
    const outDir = path.join(tmp, "out");

    const abi = [
      {
        type: "function",
        name: "set",
        stateMutability: "nonpayable",
        inputs: [{ name: "value", type: "uint256" }],
        outputs: [],
      },
    ];

    const res = generateFromArtifacts({
      outDir,
      artifacts: [
        {
          contractName: "DocToken",
          abi,
          bytecode: "0x6000",
          docs: {
            contract: "Example contract doc from Solidity.",
            functions: {
              set: "Example function doc from Solidity.",
            },
          },
        },
      ],
    });

    const contractFile = res.contracts[0].contractFile;
    const src = fs.readFileSync(contractFile, "utf8");
    assert.ok(src.includes("Example contract doc from Solidity."));
    assert.ok(src.includes("Example function doc from Solidity."));
  });
});

describe("generated identifier collisions with ABI parameter names", () => {
  logSuite("generated identifier collisions with ABI parameter names");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vm = require("node:vm");
  // Parse (not execute) generated JS; throws SyntaxError on redeclared identifiers.
  const assertParses = (file: string): string => {
    const src = fs.readFileSync(file, "utf8");
    assert.doesNotThrow(() => new vm.Script(src, { filename: path.basename(file) }));
    return src;
  };

  // Mirrors UniswapV2Pair.swap(uint,uint,address,bytes data), which shadowed the
  // generated `const data = encodeFunctionData(...)` local before the fix.
  const collisionAbi = [
    {
      type: "function",
      name: "swap",
      stateMutability: "nonpayable",
      inputs: [
        { name: "amountOut", type: "uint256" },
        { name: "to", type: "address" },
        { name: "data", type: "bytes" },
      ],
      outputs: [],
    },
    {
      type: "function",
      name: "configure",
      stateMutability: "nonpayable",
      inputs: [
        { name: "overrides", type: "uint256" },
        { name: "safeOverrides", type: "uint256" },
        { name: "k", type: "uint256" },
      ],
      outputs: [],
    },
    {
      type: "function",
      name: "lookup",
      stateMutability: "view",
      inputs: [{ name: "res", type: "uint256" }],
      outputs: [{ name: "", type: "uint256" }],
    },
    {
      type: "constructor",
      stateMutability: "nonpayable",
      inputs: [
        { name: "nonce", type: "uint256" },
        { name: "txReq", type: "address" },
        { name: "from", type: "address" },
        { name: "overrides", type: "uint256" },
      ],
    },
  ];

  it("JS: params named data/overrides/safeOverrides/res do not shadow generated locals (positive)", () => {
    logTest("JS collision-safe contract generation", {});
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-collide-js-"));
    const res = generateFromArtifacts({
      outDir,
      lang: "js",
      artifacts: [{ contractName: "CollideToken", abi: collisionAbi, bytecode: "0x6000" }],
    });

    const contractSrc = assertParses(res.contracts[0].contractFile);
    assert.ok(contractSrc.includes("swap: async (amountOut, to, data, overrides) =>"));
    assert.ok(contractSrc.includes('const _data = this.interface.encodeFunctionData("swap", [amountOut, to, data]);'));
    assert.ok(contractSrc.includes("to: this.address, data: _data"));
    assert.ok(contractSrc.includes("configure: async (overrides, safeOverrides, k, _overrides) =>"));
    assert.ok(contractSrc.includes("const _safeOverrides = {};"));
    assert.ok(contractSrc.includes("async configure(overrides, safeOverrides, k, _overrides) {"));
    assert.ok(contractSrc.includes('return this.send("configure", [overrides, safeOverrides, k], _overrides);'));
    assert.ok(contractSrc.includes("async lookup(res) {"));
    assert.ok(contractSrc.includes('const _res = await this.call("lookup", [res]);'));
  });

  it("JS factory: constructor params named nonce/txReq/from/overrides do not shadow deploy() locals (positive)", () => {
    logTest("JS collision-safe factory generation", {});
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-collide-factory-"));
    const res = generateFromArtifacts({
      outDir,
      lang: "js",
      artifacts: [{ contractName: "CollideToken", abi: collisionAbi, bytecode: "0x6000" }],
    });

    const factorySrc = assertParses(res.contracts[0].factoryFile);
    assert.ok(factorySrc.includes("async deploy(nonce, txReq, from, overrides, _overrides) {"));
    assert.ok(factorySrc.includes("let _nonce;"));
    assert.ok(factorySrc.includes("const _txReq = this.getDeployTransaction(nonce, txReq, from, overrides);"));
    assert.ok(factorySrc.includes("getCreateAddress({ from: _from, nonce: _nonce })"));

    const dts = fs.readFileSync(path.join(outDir, "CollideToken__factory.d.ts"), "utf8");
    const deployDecl = dts.split("\n").find((l) => l.includes("deploy("));
    assert.ok(deployDecl, "factory d.ts has a deploy() declaration");
    assert.ok(String(deployDecl).includes("_overrides?: any): Promise<CollideToken>;"), `got: ${deployDecl}`);
  });

  it("TS: collision ABI renames generated locals in .ts output (positive)", () => {
    logTest("TS collision-safe contract generation", {});
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-collide-ts-"));
    const res = generateFromArtifacts({
      outDir,
      lang: "ts",
      artifacts: [{ contractName: "CollideToken", abi: collisionAbi, bytecode: "0x6000" }],
    });

    const contractSrc = fs.readFileSync(res.contracts[0].contractFile, "utf8");
    assert.ok(contractSrc.includes('const _data = this.interface.encodeFunctionData("swap", [amountOut, to, data]);'));
    assert.ok(contractSrc.includes("to: this.address, data: _data"));
    assert.ok(contractSrc.includes("const _safeOverrides: any = {};"));
    assert.ok(contractSrc.includes('return this.send("configure", [overrides, safeOverrides, k], _overrides);'));
    assert.ok(contractSrc.includes("const _res = await this.call("));

    const factorySrc = fs.readFileSync(res.contracts[0].factoryFile, "utf8");
    assert.ok(factorySrc.includes("let _nonce: number;"));
    assert.ok(factorySrc.includes("const _txReq: any = this.getDeployTransaction(nonce, txReq, from, overrides);"));
  });

  it("JS: non-colliding ABI keeps the canonical local names (negative control)", () => {
    logTest("JS non-colliding generation unchanged", {});
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcgen-nocollide-"));
    const abi = [
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ];
    const res = generateFromArtifacts({
      outDir,
      lang: "js",
      artifacts: [{ contractName: "PlainToken", abi, bytecode: "0x6000" }],
    });

    const contractSrc = assertParses(res.contracts[0].contractFile);
    assert.ok(contractSrc.includes("transfer: async (to, amount, overrides) =>"));
    assert.ok(contractSrc.includes('const data = this.interface.encodeFunctionData("transfer", [to, amount]);'));
    assert.ok(contractSrc.includes("return { ...safeOverrides, to: this.address, data };"));
    assert.ok(contractSrc.includes("async transfer(to, amount, overrides) {"));
    assert.ok(contractSrc.includes("const res = await this.call("));
    assert.ok(!contractSrc.includes("_data"));
    assert.ok(!contractSrc.includes("_overrides"));

    const factorySrc = assertParses(res.contracts[0].factoryFile);
    assert.ok(factorySrc.includes("async deploy(overrides) {"));
    assert.ok(factorySrc.includes("getCreateAddress({ from, nonce })"));
    assert.ok(factorySrc.includes("const tx = await signer.sendTransaction({ ...txReq, ...safeOverrides, nonce });"));
  });
});
