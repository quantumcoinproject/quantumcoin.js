#!/usr/bin/env node
/**
 * sdkgen
 *
 * NOTE: This script is the SDK generator CLI entrypoint.
 *
 * SPEC.md section 15: Typed Contract Generator
 *
 * Usage:
 * - Non-interactive:
 *   `node generate-sdk.js --abi path/to/abi.json --bin path/to/bytecode.bin --out ./out --name MyContract`
 *
 * - Interactive:
 *   `node generate-sdk.js --abi path/to/abi.json --bin path/to/bytecode.bin`
 */

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { execFileSync, spawnSync } = require("node:child_process");

const {
  generate,
  generateFromArtifacts,
  generateTransactionalTestJs,
  generateAllContractsTransactionalTestJs,
  assertSafeIdentifier,
} = require("./src/generator");

function _helpText() {
  return `
sdkgen (generate-sdk.js)

Generates TypeScript or JavaScript contract wrappers (plus optional package scaffold, examples and transactional tests).

If you run this script with no parameters, it prints this help.

USAGE
  node generate-sdk.js [options]

INPUT MODES
  1) ABI + BIN (bytecode)
     --abi <path/to/Contract.abi.json>
     --bin <path/to/Contract.bin>
     --name <ContractName>        (optional; defaults from ABI filename)

  2) Solidity (.sol) sources
     --sol "<A.sol,B.sol,...>"    (comma-separated list; can be 1+ files)
     --name <ContractName>        (optional; if omitted, generates ALL deployable contracts found)
     --solc <path/to/solc.exe>    (optional; use an EXTERNAL solc binary instead of the default
                                   JS-based @quantumcoin/solc npm package; see ENV below)
     --solc-args "<args>"         (optional; extra args passed to the external solc binary only,
                                   e.g. "--via-ir --evm-version london"; ignored with the JS compiler)

  3) Artifacts JSON (array of ABI+BIN pairs)
     --artifacts-json <path/to/artifacts.json>
       The JSON file should be an array. Each entry supports:
         - { abi: "<path|abiJsonString|abiArray>", bin: "<path|0x...>", name?: "<ContractName>" }
       If "name" is omitted and abi is a path, the contract name defaults from the ABI filename.
 
       Example artifacts.json (ABI+BIN pairs):
         [
           {
             "abi": "./artifacts/Alpha.abi.json",
             "bin": "./artifacts/Alpha.bin",
             "name": "Alpha"
           },
           {
             "abi": [
               {
                 "type": "function",
                 "name": "set",
                 "stateMutability": "nonpayable",
                 "inputs": [{ "name": "value", "type": "uint256" }],
                 "outputs": []
               }
             ],
             "bin": "0x6000600055...",
             "name": "Beta"
           }
         ]

PACKAGE OUTPUT (optional)
  --create-package
  --package-dir <folder>
  --package-name <name>
  --package-description <text>
  --package-author <text>
  --package-license <spdx>        (default: MIT)
  --package-version <semver>      (default: 0.0.1)

  Notes:
  - When --create-package is used, the generator creates a complete npm package scaffold with:
    - src/*.(ts|js) (contracts + factories; depends on --lang)
    - test/e2e/*.e2e.test.js (transactional tests)
    - examples/ (deploy, read-operations, write-operations, offline-signing, events in .js and .ts)
    - artifacts/ (only when using --sol)
    - index.js + index.d.ts (package entry shims; TS mode uses dist/)
  - For --lang ts, the generator will run:
      npm install
      npm run build:ts
    as the final step.
  - For --lang js, the generator will run:
      npm install
    and no build step is required.

GENERAL OPTIONS
  --out <folder>                 Output folder (default: ./generated-contract)
  --lang <ts|js>                 Output language for generated contract sources (default: ts)
  --non-interactive | --yes      Disable prompts (required for CI)
  -h | --help                    Show this help

ENVIRONMENT
  QC_SOLC_PATH / SOLC / SOLC_PATH
    Optional path to an external solc executable used when compiling Solidity.
    Default: unset — Solidity is compiled in-process with the JS-based
    @quantumcoin/solc npm package (https://www.npmjs.com/package/@quantumcoin/solc).

  QC_RPC_URL / QC_CHAIN_ID
    Used by the auto-generated transactional tests in the generated package.

EXAMPLES
  Generate typed files from ABI+BIN into ./out:
    node generate-sdk.js --abi .\\artifacts\\MyContract.abi.json --bin .\\artifacts\\MyContract.bin --out .\\out --name MyContract --non-interactive

  Generate a new typed package from ABI+BIN:
    node generate-sdk.js --abi .\\My.abi.json --bin .\\My.bin --name MyContract --create-package --package-dir .\\tmp --package-name my-typed-contract --package-description "My typed contract" --package-author "me" --non-interactive

  Generate a new typed package from Solidity (single file; compiled with @quantumcoin/solc):
    node generate-sdk.js --sol ".\\contracts\\MyContract.sol" --create-package --package-dir .\\tmp --package-name my-typed-contract --package-description "My typed contract" --package-author "me" --non-interactive

  Generate a new typed package from Solidity (multiple files):
    node generate-sdk.js --sol ".\\contracts\\A.sol,.\\contracts\\B.sol,.\\contracts\\lib\\C.sol" --create-package --package-dir .\\tmp --package-name my-typed-contract --package-description "My typed contract" --package-author "me" --non-interactive

`.trimStart();
}

function _argValue(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

function _hasFlag(argv, name) {
  return argv.includes(name);
}

function _normalizeLang(v) {
  const t = (v == null ? "ts" : String(v)).trim().toLowerCase();
  if (!t) return "ts";
  if (t === "ts" || t === "typescript") return "ts";
  if (t === "js" || t === "javascript") return "js";
  throw new Error(`Invalid --lang: ${v} (expected "ts" or "js")`);
}

function _basenameNoExt(p) {
  const b = path.basename(p);
  const i = b.lastIndexOf(".");
  return i === -1 ? b : b.slice(0, i);
}

function _defaultContractNameFromAbiPath(abiPath) {
  const b = path.basename(abiPath);
  if (/\.abi\.json$/i.test(b)) return b.replace(/\.abi\.json$/i, "");
  return _basenameNoExt(abiPath);
}

function _ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function _readRootDependencies() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
  return pkg.dependencies || {};
}

function _readRootPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
}

function _readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function _looksLikeHex(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  if (t.startsWith("0x")) return /^0x[0-9a-fA-F]*$/.test(t);
  return /^[0-9a-fA-F]*$/.test(t);
}

function _readArtifactsJson(fileAbs) {
  const baseDir = path.dirname(fileAbs);
  const parsed = _readJson(fileAbs);
  if (!Array.isArray(parsed)) throw new Error(`Artifacts JSON must be an array: ${fileAbs}`);

  /** @type {Array<{ contractName: string, abi: any[], bytecode: string, docs?: any }>} */
  const artifacts = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    if (!entry || typeof entry !== "object") throw new Error(`Invalid artifacts entry at index ${i} (expected object)`);

    const abiField = entry.abi ?? entry.abiPath;
    const binField = entry.bin ?? entry.bytecode ?? entry.binPath ?? entry.bytecodePath;
    const nameField = entry.name ?? entry.contractName;

    let abi;
    let abiPath = null;
    if (typeof abiField === "string") {
      // Support either:
      // - file path to an ABI JSON file
      // - inline ABI JSON string (encoded ABI array)
      const maybePath = path.resolve(baseDir, abiField);
      if (fs.existsSync(maybePath) && fs.statSync(maybePath).isFile()) {
        abiPath = maybePath;
        abi = _readJson(abiPath);
      } else {
        try {
          abi = JSON.parse(abiField);
        } catch (e) {
          throw new Error(
            `Invalid "abi" for artifacts entry ${i} (expected ABI file path or ABI JSON string). Not found: ${maybePath}`,
          );
        }
      }
    } else if (Array.isArray(abiField)) {
      abi = abiField;
    } else {
      throw new Error(`Invalid "abi" for artifacts entry ${i} (expected path, ABI JSON string, or ABI array)`);
    }
    if (!Array.isArray(abi)) throw new Error(`ABI must be an array (entry ${i})`);

    let bytecodeRaw;
    if (typeof binField === "string") {
      const maybePath = path.resolve(baseDir, binField);
      if (fs.existsSync(maybePath) && fs.statSync(maybePath).isFile()) {
        bytecodeRaw = fs.readFileSync(maybePath, "utf8").trim();
      } else if (_looksLikeHex(binField)) {
        bytecodeRaw = binField.trim();
      } else {
        throw new Error(`BIN/bytecode file not found (entry ${i}): ${maybePath}`);
      }
    } else {
      throw new Error(`Invalid "bin" for artifacts entry ${i} (expected path or hex string)`);
    }

    const bytecode = bytecodeRaw.startsWith("0x") ? bytecodeRaw : `0x${bytecodeRaw}`;

    let contractName = null;
    if (typeof nameField === "string" && nameField.trim()) {
      contractName = _cap(nameField.trim());
    } else if (abiPath) {
      contractName = _cap(_defaultContractNameFromAbiPath(abiPath));
    } else {
      throw new Error(`Missing contract name for artifacts entry ${i}. Provide "name" or use abi as a path.`);
    }

    // Reject attacker-controlled contract names before they are used to
    // build output file paths or interpolated into generated source.
    assertSafeIdentifier(contractName, "contract name");
    artifacts.push({ contractName, abi, bytecode, docs: null });
  }

  // Ensure stable ordering and unique names
  artifacts.sort((a, b) => a.contractName.localeCompare(b.contractName));
  const seen = new Set();
  for (const a of artifacts) {
    if (seen.has(a.contractName)) throw new Error(`Duplicate contractName in artifacts JSON: ${a.contractName}`);
    seen.add(a.contractName);
  }

  if (artifacts.length === 0) throw new Error("Artifacts JSON contained no entries.");
  return artifacts;
}

function _rewriteFileDepsToAbsolute(deps, rootDir) {
  const out = { ...deps };
  for (const [name, ver] of Object.entries(out)) {
    if (typeof ver === "string" && ver.startsWith("file:")) {
      const rel = ver.slice("file:".length);
      const abs = path.resolve(rootDir, rel);
      out[name] = `file:${abs.replace(/\\\\/g, "/")}`;
    }
  }
  return out;
}

function _writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function _writeText(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function _findConstructor(abi) {
  const ctor = (abi || []).find((f) => f && f.type === "constructor");
  return ctor || { type: "constructor", inputs: [] };
}

function _solTypeToExampleValueExpr(param) {
  const type = typeof param === "string" ? param : String(param && param.type ? param.type : "");
  const internalType = typeof param === "object" && param ? String(param.internalType || "") : "";
  if (!type) return "undefined";

  // Arrays (dynamic or fixed)
  if (type.endsWith("]")) {
    const inner = type.slice(0, type.lastIndexOf("["));
    const bracket = type.slice(type.lastIndexOf("[") + 1, type.length - 1);
    const isFixed = bracket.length > 0;
    const fixedLen = isFixed ? Number(bracket) : 0;
    const elemParam = { ...(param || {}), type: inner };
    const elemExpr = _solTypeToExampleValueExpr(elemParam);
    if (isFixed && Number.isFinite(fixedLen) && fixedLen > 0) {
      // Fixed arrays MUST match the exact declared length.
      return `Array(${fixedLen}).fill(${elemExpr})`;
    }
    return `[${elemExpr}]`;
  }

  if (type === "address") return "wallet.address";
  if (type === "bool") return "true";
  if (type === "string") return JSON.stringify("hello");
  if (type === "bytes") return JSON.stringify("0x1234");

  const mBytesN = type.match(/^bytes(\d+)$/);
  if (mBytesN) {
    const n = Number(mBytesN[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 32) return JSON.stringify(`0x${"11".repeat(n)}`);
  }

  // Use plain numbers/strings for ints/uints.
  if (type.startsWith("uint") && /\benum\b/.test(internalType)) return "1";
  if (type.startsWith("uint")) return "123";
  if (type.startsWith("int")) return "-123";

  if (type === "tuple") {
    const comps = Array.isArray(param && param.components) ? param.components : [];
    if (comps.length === 0) return "{}";
    const fields = comps.map((c, idx) => {
      const name = c && typeof c.name === "string" && c.name ? c.name : `field${idx}`;
      return `${JSON.stringify(name)}: ${_solTypeToExampleValueExpr(c)}`;
    });
    return `{ ${fields.join(", ")} }`;
  }

  return "undefined";
}

function _parseCommaSeparatedFiles(v) {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function _parseSolcExtraArgs(raw) {
  if (!raw) return [];
  const t = String(raw).trim();
  if (!t) return [];

  // Allow a JSON array string: ["--via-ir","--evm-version","london"]
  if (t.startsWith("[")) {
    const arr = JSON.parse(t);
    if (!Array.isArray(arr) || !arr.every((x) => typeof x === "string")) {
      throw new Error(`--solc-args JSON must be a string[] (got: ${t.slice(0, 80)}${t.length > 80 ? "..." : ""})`);
    }
    return arr.filter((s) => s.trim()).map((s) => s.trim());
  }

  // Otherwise treat as a single string of space-separated args (basic quoting support).
  /** @type {string[]} */
  const out = [];
  let cur = "";
  let inQuote = null; // "'" | "\""
  let escaping = false;

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];

    if (escaping) {
      cur += ch;
      escaping = false;
      continue;
    }

    if (ch === "\\") {
      // allow escaping inside quotes (and harmless outside)
      escaping = true;
      continue;
    }

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  if (cur) out.push(cur);
  return out;
}

// Returns the external solc binary path when explicitly requested (via --solc
// or env vars), otherwise null — which selects the bundled JS compiler
// (@quantumcoin/solc).
function _resolveSolcPath(argv) {
  const solcArg = _argValue(argv, "--solc") || _argValue(argv, "--solc-path") || _argValue(argv, "--solcPath");
  return (
    solcArg ||
    process.env.QC_SOLC_PATH ||
    process.env.SOLC ||
    process.env.SOLC_PATH ||
    process.env.solc ||
    null
  );
}

function _assertSolcExists(solcPath) {
  if (!fs.existsSync(solcPath)) {
    throw new Error(
      `solc not found at ${solcPath}. Fix the --solc/QC_SOLC_PATH/SOLC/SOLC_PATH value, or omit it to compile with the JS-based @quantumcoin/solc package.`,
    );
  }
}

function _requireQuantumcoinSolc() {
  try {
    return require("@quantumcoin/solc");
  } catch (err) {
    throw new Error(
      "The JS Solidity compiler is not installed. Run `npm install @quantumcoin/solc`, or pass --solc <path> (or set QC_SOLC_PATH/SOLC/SOLC_PATH) to use an external solc binary.",
    );
  }
}

// Compiles with the JS-based @quantumcoin/solc via standard JSON input/output.
function _compileWithJsSolc({ solFilesAbs }) {
  const solc = _requireQuantumcoinSolc();
  const sources = {};
  for (const f of solFilesAbs) {
    sources[path.basename(f)] = { content: fs.readFileSync(f, "utf8") };
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
  // Normalize to the combined-json-like shape used below: { "<file>:<name>": { abi, bin } }
  const contracts = {};
  for (const file of Object.keys(output.contracts || {})) {
    for (const name of Object.keys(output.contracts[file])) {
      const c = output.contracts[file][name];
      const bin = c && c.evm && c.evm.bytecode && c.evm.bytecode.object ? c.evm.bytecode.object : "";
      contracts[`${file}:${name}`] = { abi: c.abi, bin };
    }
  }
  return contracts;
}

// Compiles with an external solc binary (--combined-json output).
function _compileWithExternalSolc({ solcPath, solFilesAbs, solcExtraArgs }) {
  _assertSolcExists(solcPath);
  const extra = Array.isArray(solcExtraArgs) ? solcExtraArgs : [];
  const base = extra.includes("--optimize") ? [] : ["--optimize"];
  const out = execFileSync(solcPath, [...base, ...extra, "--combined-json", "abi,bin", ...solFilesAbs], { encoding: "utf8" });
  const parsed = JSON.parse(out);
  const contracts = {};
  for (const key of Object.keys(parsed.contracts || {})) {
    const entry = parsed.contracts[key];
    const abi = entry && entry.abi ? JSON.parse(entry.abi) : null;
    const bin = entry && typeof entry.bin === "string" ? entry.bin : "";
    contracts[key] = { abi, bin };
  }
  return contracts;
}

function _compileSolidityToArtifacts({ solcPath, solFilesAbs, contractNameFilter, solcExtraArgs }) {
  // Default: JS-based @quantumcoin/solc. An explicit --solc/QC_SOLC_PATH/SOLC/SOLC_PATH
  // switches to the external binary (the only mode where --solc-args applies).
  if (!solcPath && Array.isArray(solcExtraArgs) && solcExtraArgs.length > 0) {
    console.warn("Warning: --solc-args only applies to an external solc binary (--solc <path>); ignored with the JS compiler.");
  }
  const contracts = solcPath
    ? _compileWithExternalSolc({ solcPath, solFilesAbs, solcExtraArgs })
    : _compileWithJsSolc({ solFilesAbs });

  const artifacts = [];
  for (const key of Object.keys(contracts)) {
    const entry = contracts[key];
    const name = key.includes(":") ? key.split(":").pop() : key;
    if (!name) continue;
    if (contractNameFilter && name !== contractNameFilter) continue;
    const abi = entry.abi;
    const bin = typeof entry.bin === "string" ? entry.bin : "";
    if (!abi || !Array.isArray(abi)) continue;
    if (!bin) continue; // skip abstract/interfaces
    // Validate before _writeSolcArtifacts uses the name to build paths.
    assertSafeIdentifier(name, "contract name");
    artifacts.push({ contractName: name, abi, bytecode: bin.startsWith("0x") ? bin : `0x${bin}` });
  }

  if (contractNameFilter && artifacts.length === 0) {
    throw new Error(`No compiled contract matched --name ${contractNameFilter}`);
  }
  if (artifacts.length === 0) {
    throw new Error("No deployable contracts found in solc output (empty bytecode).");
  }

  // Stable ordering
  artifacts.sort((a, b) => a.contractName.localeCompare(b.contractName));
  return artifacts;
}

function _writeSolcArtifacts(outRoot, artifacts) {
  const artifactsDir = path.join(outRoot, "artifacts");
  _ensureDir(artifactsDir);
  for (const a of artifacts) {
    _writeText(path.join(artifactsDir, `${a.contractName}.abi.json`), JSON.stringify(a.abi, null, 2) + "\n");
    _writeText(path.join(artifactsDir, `${a.contractName}.bin`), a.bytecode + "\n");
  }
}

function _normalizeSolDoc(text) {
  if (!text) return "";
  return text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      // Normalize common NatSpec tags into plain text (but keep @param/@return as-is)
      if (l.startsWith("@title ")) return l.slice("@title ".length).trim();
      if (l.startsWith("@notice ")) return l.slice("@notice ".length).trim();
      if (l.startsWith("@dev ")) return l.slice("@dev ".length).trim();
      return l;
    })
    .filter(Boolean)
    // Defense-in-depth: doc text is later embedded inside generated `/** ... */`
    // JSDoc blocks. Neutralize comment delimiters here too so a `*/` in NatSpec can
    // never close the generated comment early and inject executable code.
    .map((l) => l.replace(/\*\//g, "* /").replace(/\/\*/g, "/ *"))
    .join("\n")
    .trim();
}

function _extractSolDocs(solFilesAbs) {
  /** @type {Record<string, { contract?: string, functions: Record<string,string> }>} */
  const out = {};

  for (const file of solFilesAbs) {
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split(/\r?\n/g);

    let pending = [];
    let inBlock = false;
    let currentContract = null;

    const flushPending = () => {
      const s = _normalizeSolDoc(pending.join("\n"));
      pending = [];
      return s;
    };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const t = raw.trim();

      if (inBlock) {
        // Capture block comment content lines, stripping leading '*' and the closing '*/'
        const endIdx = raw.indexOf("*/");
        const content = endIdx !== -1 ? raw.slice(0, endIdx) : raw;
        const cleaned = content.replace(/^\s*\*\s?/, "").trim();
        if (cleaned) pending.push(cleaned);
        if (endIdx !== -1) inBlock = false;
        continue;
      }

      // Solidity NatSpec / doc comments
      if (t.startsWith("/**")) {
        inBlock = true;
        // Capture anything after '/**' on the same line and handle one-line comments.
        const startIdx = raw.indexOf("/**") + 3;
        const rest = raw.slice(startIdx);
        const endIdx = rest.indexOf("*/");
        const content = endIdx !== -1 ? rest.slice(0, endIdx) : rest;
        const cleaned = content.replace(/^\s*\*\s?/, "").trim();
        if (cleaned) pending.push(cleaned);
        if (endIdx !== -1) inBlock = false;
        continue;
      }
      if (t.startsWith("///")) {
        pending.push(t.slice(3).trim());
        continue;
      }

      // Skip empty lines without breaking pending docs
      if (!t) continue;

      // Contract/interface/library declaration
      const cMatch = t.match(/^(contract|interface|library)\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
      if (cMatch) {
        const name = cMatch[2];
        const doc = flushPending();
        currentContract = name;
        if (!out[name]) out[name] = { contract: "", functions: {} };
        if (doc) out[name].contract = doc;
        continue;
      }

      // Function declaration
      const fMatch = t.match(/^function\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
      if (fMatch && currentContract) {
        const fn = fMatch[1];
        const doc = flushPending();
        if (!out[currentContract]) out[currentContract] = { contract: "", functions: {} };
        if (doc) out[currentContract].functions[fn] = doc;
        continue;
      }

      // If we hit a real code line that's not a declaration, discard any pending doc
      pending = [];
    }
  }

  // Normalize all docs
  for (const k of Object.keys(out)) {
    out[k].contract = _normalizeSolDoc(out[k].contract || "");
    for (const fn of Object.keys(out[k].functions || {})) {
      out[k].functions[fn] = _normalizeSolDoc(out[k].functions[fn]);
    }
  }

  return out;
}

function _renderPackageIndexJs({ artifacts, entryDir }) {
  const dir = entryDir || "dist";
  const lines = [];
  lines.push("/**");
  lines.push(" * Auto-generated typed contract package.");
  lines.push(" *");
  lines.push(` * This file re-exports the package entry bundle in \`${dir}/\`.`);
  lines.push(" */");
  lines.push("");
  lines.push(`const entry = require("./${dir}");`);
  lines.push("Object.assign(exports, entry);");
  lines.push("");

  for (const a of artifacts) {
    const doc = a.docs && typeof a.docs.contract === "string" ? a.docs.contract : "";
    if (doc && doc.trim()) {
      lines.push("/**");
      for (const l of doc.split(/\r?\n/g)) {
        const t = l.trim();
        if (!t) continue;
        lines.push(` * ${t}`);
      }
      lines.push(" */");
    } else {
      lines.push("/**");
      lines.push(` * ${a.contractName}`);
      lines.push(" */");
    }
    lines.push(`exports.${a.contractName} = entry.${a.contractName};`);
    lines.push(`exports.${a.contractName}__factory = entry.${a.contractName}__factory;`);
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function _quoteIfNeeded(s) {
  if (typeof s !== "string") return s;
  return /[ \t"]/g.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

function _npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function _runNpm(args, cwd) {
  if (process.platform === "win32") {
    const cmd = `${_npmCmd()} ${args.map(_quoteIfNeeded).join(" ")}`;
    const res = spawnSync("cmd.exe", ["/d", "/s", "/c", cmd], { cwd, encoding: "utf8", stdio: "inherit" });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(`npm command failed: ${cmd}`);
    return;
  }

  const res = spawnSync(_npmCmd(), args, { cwd, encoding: "utf8", stdio: "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`npm command failed: ${_npmCmd()} ${args.join(" ")}`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || _hasFlag(argv, "--help") || _hasFlag(argv, "-h")) {
    process.stdout.write(_helpText());
    process.exitCode = 0;
    return;
  }

  const abiPathArg = _argValue(argv, "--abi");
  const binPathArg = _argValue(argv, "--bin");
  const solArg = _argValue(argv, "--sol") || _argValue(argv, "--sol-files") || _argValue(argv, "--solFiles");
  const solcArgsRaw = _argValue(argv, "--solc-args") || _argValue(argv, "--solcArgs");
  const artifactsJsonArg =
    _argValue(argv, "--artifacts-json") || _argValue(argv, "--artifactsJson") || _argValue(argv, "--artifacts");
  const outArg = _argValue(argv, "--out");
  const nameArg = _argValue(argv, "--name");
  const nonInteractive = _hasFlag(argv, "--non-interactive") || _hasFlag(argv, "--yes");
  const createPackageFlag = _hasFlag(argv, "--create-package");
  const pkgDirArg = _argValue(argv, "--package-dir");
  const pkgNameArg = _argValue(argv, "--package-name");
  const pkgDescArg = _argValue(argv, "--package-description") || "";
  const pkgAuthorArg = _argValue(argv, "--package-author") || "";
  const pkgLicenseArg = _argValue(argv, "--package-license") || "MIT";
  const pkgVersionArg = _argValue(argv, "--package-version") || "0.0.1";
  const lang = _normalizeLang(_argValue(argv, "--lang") || _argValue(argv, "--language") || _argValue(argv, "--type"));

  // Decide input type.
  let inputType = null; // "abibin" | "sol" | "artifactsjson"
  if (solArg) inputType = "sol";
  if (artifactsJsonArg) inputType = inputType || "artifactsjson";
  if (abiPathArg || binPathArg) inputType = inputType || "abibin";
  if ((solArg ? 1 : 0) + (artifactsJsonArg ? 1 : 0) + (abiPathArg || binPathArg ? 1 : 0) > 1) {
    throw new Error("Select only one input mode: --abi/--bin OR --sol OR --artifacts-json.");
  }

  let createPackage = false;
  let outDir = outArg ? path.resolve(outArg) : null;
  let contractName = nameArg || null;

  // Interactive prompt: ask input type first.
  let absAbi = null;
  let absBin = null;
  let solFilesAbs = [];
  let artifactsJsonAbs = null;
  const solcExtraArgs = solcArgsRaw ? _parseSolcExtraArgs(solcArgsRaw) : [];

  if (!nonInteractive) {
    const rl0 = readline.createInterface({ input: stdin, output: stdout });
    try {
      if (!inputType) {
        const ans = (await rl0.question("Input type? (1) ABI+BIN  (2) SOL  (3) ARTIFACTS JSON  ")).trim();
        inputType = ans === "2" ? "sol" : ans === "3" ? "artifactsjson" : "abibin";
      }
      if (inputType === "abibin") {
        const abiP = abiPathArg || (await rl0.question("Enter ABI path (.json): ")).trim();
        const binP = binPathArg || (await rl0.question("Enter bytecode path (.bin): ")).trim();
        if (!abiP || !binP) throw new Error("Missing ABI/BIN paths.");
        absAbi = path.resolve(abiP);
        absBin = path.resolve(binP);
        if (!fs.existsSync(absAbi)) throw new Error(`ABI file not found: ${absAbi}`);
        if (!fs.existsSync(absBin)) throw new Error(`Bytecode file not found: ${absBin}`);
        contractName = contractName || _cap(_defaultContractNameFromAbiPath(absAbi));
      } else if (inputType === "sol") {
        const solP = solArg || (await rl0.question("Enter Solidity file(s) (comma-separated): ")).trim();
        const files = _parseCommaSeparatedFiles(solP);
        if (files.length === 0) throw new Error("Missing Solidity file(s).");
        solFilesAbs = files.map((p) => path.resolve(p));
        for (const f of solFilesAbs) {
          if (!fs.existsSync(f)) throw new Error(`Solidity file not found: ${f}`);
        }
        if (!contractName) {
          const maybe = (await rl0.question("Contract name (optional; empty = generate all): ")).trim();
          if (maybe) contractName = maybe;
        }
      } else {
        const p = artifactsJsonArg || (await rl0.question("Enter artifacts JSON path (.json): ")).trim();
        if (!p) throw new Error("Missing artifacts JSON path.");
        artifactsJsonAbs = path.resolve(p);
        if (!fs.existsSync(artifactsJsonAbs)) throw new Error(`Artifacts JSON file not found: ${artifactsJsonAbs}`);
      }
    } finally {
      rl0.close();
    }
  }

  // Non-interactive input validation
  if (nonInteractive) {
    if (!inputType) {
      throw new Error("Select an input type: pass --abi/--bin OR pass --sol <file1.sol,file2.sol> OR pass --artifacts-json <file.json>.");
    }
    if (inputType === "abibin") {
      if (!abiPathArg || !binPathArg) {
        throw new Error("Missing required arguments: --abi <path> --bin <path>");
      }
      absAbi = path.resolve(abiPathArg);
      absBin = path.resolve(binPathArg);
      if (!fs.existsSync(absAbi)) throw new Error(`ABI file not found: ${absAbi}`);
      if (!fs.existsSync(absBin)) throw new Error(`Bytecode file not found: ${absBin}`);
      contractName = contractName || _cap(_defaultContractNameFromAbiPath(absAbi));
    } else if (inputType === "sol") {
      const files = _parseCommaSeparatedFiles(solArg);
      if (files.length === 0) throw new Error("Missing required argument: --sol <file1.sol,file2.sol>");
      solFilesAbs = files.map((p) => path.resolve(p));
      for (const f of solFilesAbs) {
        if (!fs.existsSync(f)) throw new Error(`Solidity file not found: ${f}`);
      }
      // contractName can be null => generate all
    } else {
      if (!artifactsJsonArg) throw new Error("Missing required argument: --artifacts-json <path/to/artifacts.json>");
      artifactsJsonAbs = path.resolve(artifactsJsonArg);
      if (!fs.existsSync(artifactsJsonAbs)) throw new Error(`Artifacts JSON file not found: ${artifactsJsonAbs}`);
    }
  }

  if (createPackageFlag) {
    createPackage = true;
  }

  if (!nonInteractive && !createPackageFlag) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      const ans = (await rl.question("Do you want to create a new package? (Y/N) ")).trim().toLowerCase();
      createPackage = ans === "y" || ans === "yes";

      if (createPackage) {
        const pkgFolder = (await rl.question("Enter the folder path where the package should be created: ")).trim();
        const pkgName = (await rl.question("Enter package name: ")).trim();
        const pkgDesc = (await rl.question("Enter package description: ")).trim();
        const pkgAuthor = (await rl.question("Enter author name: ")).trim();
        const pkgLicense = (await rl.question("Enter license (default: MIT): ")).trim() || "MIT";
        const pkgVersion = (await rl.question("Enter version (default: 0.0.1): ")).trim() || "0.0.1";

        outDir = path.resolve(pkgFolder, pkgName);
        _ensureDir(outDir);

        _createPackageScaffold({
          outDir,
          pkgName,
          pkgDesc,
          pkgAuthor,
          pkgLicense,
          pkgVersion,
          lang,
        });
      } else {
        const target = (await rl.question("Enter the location in your existing package (relative to package root): ")).trim();
        outDir = path.resolve(process.cwd(), target || "src/contracts");
      }
    } finally {
      rl.close();
    }
  }

  if (createPackage && nonInteractive) {
    const pkgFolder = pkgDirArg ? path.resolve(pkgDirArg) : null;
    const pkgName = pkgNameArg || null;
    if (!pkgFolder || !pkgName) {
      throw new Error("When using --create-package in non-interactive mode, pass --package-dir <dir> and --package-name <name>.");
    }
    outDir = path.resolve(pkgFolder, pkgName);
    _ensureDir(outDir);
    _createPackageScaffold({
      outDir,
      pkgName,
      pkgDesc: pkgDescArg,
      pkgAuthor: pkgAuthorArg,
      pkgLicense: pkgLicenseArg,
      pkgVersion: pkgVersionArg,
      lang,
    });
  }

  if (!outDir) outDir = path.resolve(process.cwd(), "generated-contract");

  const targetSrcDir = createPackage ? path.join(outDir, "src") : outDir;
  _ensureDir(targetSrcDir);

  // Resolve compilation / artifacts
  /** @type {Array<{ contractName: string, abi: any[], bytecode: string }>} */
  let artifacts = [];
  if (inputType === "abibin") {
    const abi = _readJson(absAbi);
    const bytecodeRaw = fs.readFileSync(absBin, "utf8").trim();
    const bytecode = bytecodeRaw.startsWith("0x") ? bytecodeRaw : `0x${bytecodeRaw}`;
    artifacts = [{ contractName, abi, bytecode, docs: null }];
  } else if (inputType === "sol") {
    const solcPath = _resolveSolcPath(argv);
    artifacts = _compileSolidityToArtifacts({ solcPath, solFilesAbs, contractNameFilter: contractName, solcExtraArgs });

    // Attach Solidity doc comments (NatSpec) to artifacts
    const docsByContract = _extractSolDocs(solFilesAbs);
    for (const a of artifacts) {
      a.docs = docsByContract[a.contractName] || null;
    }

    // As requested: emit ABI/BIN artifacts to disk
    _writeSolcArtifacts(createPackage ? outDir : targetSrcDir, artifacts);
  } else {
    // Artifacts JSON
    artifacts = _readArtifactsJson(artifactsJsonAbs || path.resolve(artifactsJsonArg));
  }

  // Final guard — every contract name used for code generation and for
  // building output/example/test file paths must be a safe identifier.
  for (const a of artifacts) {
    assertSafeIdentifier(a && a.contractName, "contract name");
  }

  if (artifacts.length === 1) {
    // Keep the old API/behavior for single-contract generation.
    const a = artifacts[0];
    generateFromArtifacts({ outDir: targetSrcDir, artifacts: [a], lang });
  } else {
    generateFromArtifacts({ outDir: targetSrcDir, artifacts, lang });
  }

  if (createPackage) {
    _writeText(
      path.join(outDir, "README.md"),
      _packageReadme({
        pkgName: pkgNameArg || path.basename(outDir),
        pkgDesc: pkgDescArg,
        artifacts,
        createdFromSolidity: inputType === "sol",
        lang,
      }),
    );

    // Transactional tests (always per-contract)
    _ensureDir(path.join(outDir, "test", "e2e"));
    _ensureDir(path.join(outDir, "examples"));

    // Shared helper for examples (keeps examples runnable via plain `node`).
    // WARNING: test-only wallet; never use for real funds.
    _writeText(
      path.join(outDir, "examples", "_test-wallet.js"),
      `const { Wallet } = require("quantumcoin");\n\n// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)\nconst TEST_WALLET_ENCRYPTED_JSON =\n  ${JSON.stringify(
        "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
      )};\nconst TEST_WALLET_PASSPHRASE = \"QuantumCoinExample123!\";\n\nfunction createTestWallet(provider) {\n  // Caller must have called Initialize() first.\n  return Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);\n}\n\nmodule.exports = {\n  TEST_WALLET_ENCRYPTED_JSON,\n  TEST_WALLET_PASSPHRASE,\n  createTestWallet,\n};\n`,
    );

    // TypeScript _test-wallet (for TS examples)
    _writeText(
      path.join(outDir, "examples", "_test-wallet.ts"),
      `import { Wallet } from "quantumcoin";

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
export const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
        "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
      )};
export const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

export function createTestWallet(provider: unknown) {
  return Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);
}
`,
    );

    for (const a of artifacts) {
      _writeText(
        path.join(outDir, "test", "e2e", `${a.contractName}.e2e.test.js`),
        generateTransactionalTestJs({ contractName: a.contractName, abi: a.abi, bytecode: a.bytecode }),
      );
    }

    if (artifacts.length > 1) {
      _writeText(
        path.join(outDir, "test", "e2e", "all-contracts.e2e.test.js"),
        generateAllContractsTransactionalTestJs({
          artifacts: artifacts.map((a) => ({ contractName: a.contractName, abi: a.abi, bytecode: a.bytecode })),
        }),
      );
    }

    if (artifacts.length === 1) {
      // Back-compat: keep original example filenames for a single-contract package.
      const a = artifacts[0];
      const ctor = _findConstructor(a.abi);
      const ctorArgsExpr = (ctor.inputs || []).map((i) => _solTypeToExampleValueExpr(i)).join(", ");

      _writeText(
        path.join(outDir, "examples", "deploy.js"),
        `/**
 * Deploy example (generated).
 *
 * Requires:
 * - QC_RPC_URL env var
 *
 * WARNING: uses a hardcoded test wallet (funded) for convenience.
 */
const { Initialize } = require("quantumcoin/config");
const { getProvider, Wallet } = require("quantumcoin");
const { ${a.contractName}__factory } = require("..");

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);

  const factory = new ${a.contractName}__factory(wallet);
  const contract = await factory.deploy(${ctorArgsExpr}${ctorArgsExpr ? ", " : ""}{ gasLimit: 600000 });
  const tx = contract.deployTransaction();
  if (tx) await tx.wait(1, 600_000);

  console.log("Deployed at:", contract.target);
  console.log("Next:");
  console.log('  $env:CONTRACT_ADDRESS="' + contract.target + '"');
  console.log("  node examples/read-operations.js");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "deploy.ts"),
        `/**
 * Deploy example (generated) - TypeScript.
 *
 * Requires:
 * - QC_RPC_URL env var
 *
 * WARNING: uses a hardcoded test wallet (funded) for convenience.
 */
import { Initialize } from "quantumcoin/config";
import { getProvider, Wallet } from "quantumcoin";
import { ${a.contractName}__factory } from "..";

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

async function main(): Promise<void> {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);

  const factory = new ${a.contractName}__factory(wallet);
  const contract = await factory.deploy(${ctorArgsExpr}${ctorArgsExpr ? ", " : ""}{ gasLimit: 600000 });
  const tx = contract.deployTransaction();
  if (tx) await tx.wait(1, 600_000);

  console.log("Deployed at:", contract.target);
  console.log("Next:");
  console.log('  $env:CONTRACT_ADDRESS="' + contract.target + '"');
  console.log("  npx tsx examples/read-operations.ts");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "read-operations.js"),
        `/**
 * Read operations example (generated).
 *
 * Requires:
 * - QC_RPC_URL env var
 * - CONTRACT_ADDRESS env var
 */
const { Initialize } = require("quantumcoin/config");
const { getProvider } = require("quantumcoin");
const { ${a.contractName} } = require("..");

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const contract = ${a.contractName}.connect(address, provider);

  console.log("Contract:", contract.target);

  if (typeof contract.name === "function") {
    console.log("name():", await contract.name());
  }
  if (typeof contract.symbol === "function") {
    console.log("symbol():", await contract.symbol());
  }
  if (typeof contract.totalSupply === "function") {
    // Generated wrappers already unwrap single-return values to a hard type.
    const v = await contract.totalSupply();
    console.log("totalSupply():", v.toString());
  }
  if (typeof contract.balanceOf === "function" && process.env.WALLET_ADDRESS) {
    // Generated wrappers already unwrap single-return values to a hard type.
    const v = await contract.balanceOf(process.env.WALLET_ADDRESS);
    console.log("balanceOf(WALLET_ADDRESS):", v.toString());
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "read-operations.ts"),
        `/**
 * Read operations example (generated) - TypeScript.
 *
 * Requires:
 * - QC_RPC_URL env var
 * - CONTRACT_ADDRESS env var
 */
import { Initialize } from "quantumcoin/config";
import { getProvider } from "quantumcoin";
import { ${a.contractName} } from "..";

async function main(): Promise<void> {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const contract = ${a.contractName}.connect(address, provider);

  console.log("Contract:", contract.target);

  if (typeof contract.name === "function") {
    console.log("name():", await contract.name());
  }
  if (typeof contract.symbol === "function") {
    console.log("symbol():", await contract.symbol());
  }
  if (typeof contract.totalSupply === "function") {
    const v = await contract.totalSupply();
    console.log("totalSupply():", v.toString());
  }
  if (typeof contract.balanceOf === "function" && process.env.WALLET_ADDRESS) {
    const v = await contract.balanceOf(process.env.WALLET_ADDRESS);
    console.log("balanceOf(WALLET_ADDRESS):", v.toString());
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "write-operations.js"),
        `/**
 * Write operations example (generated).
 *
 * Requires:
 * - QC_RPC_URL env var
 * - CONTRACT_ADDRESS env var
 *
 * WARNING: uses a hardcoded test wallet (funded) for convenience.
 */
const { Initialize } = require("quantumcoin/config");
const { getProvider, Wallet } = require("quantumcoin");
const { ${a.contractName} } = require("..");

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);
  const contract = ${a.contractName}.connect(address, wallet);

  if (typeof contract.approve === "function") {
    const tx = await contract.approve(wallet.address, 123, { gasLimit: 200000 });
    await tx.wait(1, 600_000);
    console.log("approve(wallet.address, 123) succeeded");
    return;
  }

  console.log("No known write method template for this ABI.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "write-operations.ts"),
        `/**
 * Write operations example (generated) - TypeScript.
 *
 * Requires:
 * - QC_RPC_URL env var
 * - CONTRACT_ADDRESS env var
 *
 * WARNING: uses a hardcoded test wallet (funded) for convenience.
 */
import { Initialize } from "quantumcoin/config";
import { getProvider, Wallet } from "quantumcoin";
import { ${a.contractName} } from "..";

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

async function main(): Promise<void> {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);
  const contract = ${a.contractName}.connect(address, wallet);

  if (typeof contract.approve === "function") {
    const tx = await contract.approve(wallet.address, 123, { gasLimit: 200000 });
    await tx.wait(1, 600_000);
    console.log("approve(wallet.address, 123) succeeded");
    return;
  }

  console.log("No known write method template for this ABI.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "offline-signing.js"),
        `/**
 * Offline signing example (generated).
 *
 * Demonstrates:
 * - ${a.contractName}__factory.getDeployTransaction(...)
 * - contract.populateTransaction.<method>(...)
 * - wallet.signTransaction(txReq) (offline) + provider.sendRawTransaction(rawTx)
 *
 * Requires:
 * - QC_RPC_URL env var
 *
 * WARNING: uses a hardcoded test wallet (funded) for convenience.
 */
const { Initialize } = require("quantumcoin/config");
const { getProvider, Wallet, getCreateAddress } = require("quantumcoin");
const { ${a.contractName}, ${a.contractName}__factory } = require("..");

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;

  await Initialize(null);
  const provider = getProvider(rpcUrl, chainId);

  // Offline wallet (no provider attached). We'll resolve nonce from provider manually.
  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE);
  const from = wallet.address;

  const factory = new ${a.contractName}__factory(wallet);
  const deployTxReq = factory.getDeployTransaction(${ctorArgsExpr});

  let gasLimit = 600000;
  try {
    const est = await provider.estimateGas({ from, data: deployTxReq.data });
    gasLimit = Number(est + 200_000n);
  } catch {
    gasLimit = 6_000_000;
  }
  const bytecodeSize = (${a.contractName}.bytecode || "").length;
  if (bytecodeSize > 20000 && gasLimit < 6_000_000) gasLimit = 6_000_000;

  const nonce0 = await provider.getTransactionCount(from, "pending");
  const predicted = getCreateAddress({ from, nonce: nonce0 });

  const rawDeploy = await wallet.signTransaction({
    ...deployTxReq,
    nonce: nonce0,
    chainId,
    gasLimit,
  });

  const sentDeploy = await provider.sendRawTransaction(rawDeploy);
  console.log("deploy tx hash:", sentDeploy.hash);
  await sentDeploy.wait(1, 600_000);

  const contract = ${a.contractName}.connect(predicted, provider);
  console.log("deployed at:", contract.target);

  // Optional: offline-sign a write method if present (ERC20-like approve)
  if (contract.populateTransaction && typeof contract.populateTransaction.approve === "function") {
    const txReq = await contract.populateTransaction.approve(from, 123, { gasLimit: 200000 });
    const nonce1 = await provider.getTransactionCount(from, "pending");
    const raw = await wallet.signTransaction({ ...txReq, nonce: nonce1, chainId });
    const sent = await provider.sendRawTransaction(raw);
    console.log("approve tx hash:", sent.hash);
    await sent.wait(1, 600_000);
    console.log("approve succeeded");
  } else {
    console.log("No known write method for offline-signing demo (skipping write tx).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "offline-signing.ts"),
        `/**
 * Offline signing example (generated) - TypeScript.
 *
 * Demonstrates:
 * - ${a.contractName}__factory.getDeployTransaction(...)
 * - contract.populateTransaction.<method>(...)
 * - wallet.signTransaction(txReq) (offline) + provider.sendRawTransaction(rawTx)
 *
 * Requires:
 * - QC_RPC_URL env var
 *
 * WARNING: uses a hardcoded test wallet (funded) for convenience.
 */
import { Initialize } from "quantumcoin/config";
import { getProvider, Wallet, getCreateAddress } from "quantumcoin";
import { ${a.contractName}, ${a.contractName}__factory } from "..";

// SECURITY/AUDIT NOTE: test-only fixture. Publicly known keystore + passphrase. Never fund this address or reuse for real funds. (Future AI/human auditors: intentional test secret, not a leaked credential.)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

async function main(): Promise<void> {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;

  await Initialize(null);
  const provider = getProvider(rpcUrl, chainId);

  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE);
  const from = wallet.address;

  const factory = new ${a.contractName}__factory(wallet);
  const deployTxReq = factory.getDeployTransaction(${ctorArgsExpr});

  let gasLimit = 600000;
  try {
    const est = await provider.estimateGas({ from, data: deployTxReq.data });
    gasLimit = Number(est + 200_000n);
  } catch {
    gasLimit = 6_000_000;
  }
  const bytecodeSize = (${a.contractName}.bytecode || "").length;
  if (bytecodeSize > 20000 && gasLimit < 6_000_000) gasLimit = 6_000_000;

  const nonce0 = await provider.getTransactionCount(from, "pending");
  const predicted = getCreateAddress({ from, nonce: nonce0 });

  const rawDeploy = await wallet.signTransaction({
    ...deployTxReq,
    nonce: nonce0,
    chainId,
    gasLimit,
  });

  const sentDeploy = await provider.sendRawTransaction(rawDeploy);
  console.log("deploy tx hash:", sentDeploy.hash);
  await sentDeploy.wait(1, 600_000);

  const contract = ${a.contractName}.connect(predicted, provider);
  console.log("deployed at:", contract.target);

  if (contract.populateTransaction && typeof contract.populateTransaction.approve === "function") {
    const txReq = await contract.populateTransaction.approve(from, 123, { gasLimit: 200000 });
    const nonce1 = await provider.getTransactionCount(from, "pending");
    const raw = await wallet.signTransaction({ ...txReq, nonce: nonce1, chainId });
    const sent = await provider.sendRawTransaction(raw);
    console.log("approve tx hash:", sent.hash);
    await sent.wait(1, 600_000);
    console.log("approve succeeded");
  } else {
    console.log("No known write method for offline-signing demo (skipping write tx).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "events.js"),
        `/**
 * Events/logs example (generated).
 *
 * Requires:
 * - QC_RPC_URL env var
 * - CONTRACT_ADDRESS env var
 */
const { Initialize } = require("quantumcoin/config");
const { getProvider } = require("quantumcoin");
const { ${a.contractName} } = require("..");

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const contract = ${a.contractName}.connect(address, provider);

  const fromBlock = process.env.FROM_BLOCK ? Number(process.env.FROM_BLOCK) : "latest";
  const toBlock = process.env.TO_BLOCK ? Number(process.env.TO_BLOCK) : "latest";

  const logs = await contract.queryFilter("Transfer", fromBlock, toBlock);
  console.log("Logs:", logs.length);
  for (const l of logs.slice(0, 10)) {
    console.log(l);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );

      _writeText(
        path.join(outDir, "examples", "events.ts"),
        `/**
 * Events/logs example (generated) - TypeScript.
 *
 * Requires:
 * - QC_RPC_URL env var
 * - CONTRACT_ADDRESS env var
 */
import { Initialize } from "quantumcoin/config";
import { getProvider } from "quantumcoin";
import { ${a.contractName} } from "..";

async function main(): Promise<void> {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = getProvider(rpcUrl, chainId);
  const contract = ${a.contractName}.connect(address, provider);

  const fromBlock = process.env.FROM_BLOCK ? Number(process.env.FROM_BLOCK) : "latest";
  const toBlock = process.env.TO_BLOCK ? Number(process.env.TO_BLOCK) : "latest";

  const logs = await contract.queryFilter("Transfer", fromBlock, toBlock);
  console.log("Logs:", logs.length);
  for (const l of logs.slice(0, 10)) {
    console.log(l);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
`,
      );
    } else {
      // Multi-contract: avoid filename collisions.
      for (const a of artifacts) {
        const ctor = _findConstructor(a.abi);
        const ctorArgsExpr = (ctor.inputs || []).map((i) => _solTypeToExampleValueExpr(i)).join(", ");

        _writeText(
          path.join(outDir, "examples", `deploy-${a.contractName}.js`),
          `const { Initialize } = require("quantumcoin/config");\nconst { getProvider } = require("quantumcoin");\nconst { createTestWallet } = require("./_test-wallet");\nconst { ${a.contractName}__factory } = require("..");\n\nasync function main() {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const wallet = createTestWallet(provider);\n\n  const factory = new ${a.contractName}__factory(wallet);\n  const contract = await factory.deploy(${ctorArgsExpr}${ctorArgsExpr ? ", " : ""}{ gasLimit: 600000 });\n  const tx = contract.deployTransaction();\n  if (tx) await tx.wait(1, 600_000);\n\n  console.log("Deployed ${a.contractName} at:", contract.target);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );

        _writeText(
          path.join(outDir, "examples", `read-operations-${a.contractName}.js`),
          `const { Initialize } = require("quantumcoin/config");\nconst { getProvider } = require("quantumcoin");\nconst { ${a.contractName} } = require("..");\n\nasync function main() {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  const address = process.env.CONTRACT_ADDRESS;\n  if (!address) throw new Error("CONTRACT_ADDRESS is required");\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const contract = ${a.contractName}.connect(address, provider);\n\n  console.log("${a.contractName}:", contract.target);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );

        _writeText(
          path.join(outDir, "examples", `write-operations-${a.contractName}.js`),
          `const { Initialize } = require("quantumcoin/config");\nconst { getProvider } = require("quantumcoin");\nconst { createTestWallet } = require("./_test-wallet");\nconst { ${a.contractName} } = require("..");\n\nasync function main() {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  const address = process.env.CONTRACT_ADDRESS;\n  if (!address) throw new Error("CONTRACT_ADDRESS is required");\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const wallet = createTestWallet(provider);\n  const contract = ${a.contractName}.connect(address, wallet);\n\n  console.log("Connected:", contract.target);\n  console.log("Done");\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );

        _writeText(
          path.join(outDir, "examples", `offline-signing-${a.contractName}.js`),
          `const { Initialize } = require("quantumcoin/config");\nconst { getProvider, Wallet, getCreateAddress } = require("quantumcoin");\nconst { TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE } = require("./_test-wallet");\nconst { ${a.contractName}__factory, ${a.contractName} } = require("..");\n\nasync function main() {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE);\n  const from = wallet.address;\n\n  const factory = new ${a.contractName}__factory(wallet);\n  const deployTxReq = factory.getDeployTransaction();\n  const nonce0 = await provider.getTransactionCount(from, \"pending\");\n  const predicted = getCreateAddress({ from, nonce: nonce0 });\n\n  const rawDeploy = await wallet.signTransaction({ ...deployTxReq, nonce: nonce0, chainId, gasLimit: 6_000_000 });\n  const sentDeploy = await provider.sendRawTransaction(rawDeploy);\n  await sentDeploy.wait(1, 600_000);\n\n  const contract = ${a.contractName}.connect(predicted, provider);\n  console.log(\"deployed at:\", contract.target);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );

        _writeText(
          path.join(outDir, "examples", `events-${a.contractName}.js`),
          `const { Initialize } = require("quantumcoin/config");\nconst { getProvider } = require("quantumcoin");\nconst { ${a.contractName} } = require("..");\n\nasync function main() {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  const address = process.env.CONTRACT_ADDRESS;\n  if (!address) throw new Error("CONTRACT_ADDRESS is required");\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const contract = ${a.contractName}.connect(address, provider);\n\n  const logs = await contract.queryFilter("Transfer", "latest", "latest");\n  console.log("Logs:", logs.length);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );

        _writeText(
          path.join(outDir, "examples", `deploy-${a.contractName}.ts`),
          `import { Initialize } from "quantumcoin/config";\nimport { getProvider } from "quantumcoin";\nimport { createTestWallet } from "./_test-wallet";\nimport { ${a.contractName}__factory } from "..";\n\nasync function main(): Promise<void> {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const wallet = createTestWallet(provider);\n\n  const factory = new ${a.contractName}__factory(wallet);\n  const contract = await factory.deploy(${ctorArgsExpr}${ctorArgsExpr ? ", " : ""}{ gasLimit: 600000 });\n  const tx = contract.deployTransaction();\n  if (tx) await tx.wait(1, 600_000);\n\n  console.log("Deployed ${a.contractName} at:", contract.target);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );
        _writeText(
          path.join(outDir, "examples", `read-operations-${a.contractName}.ts`),
          `import { Initialize } from "quantumcoin/config";\nimport { getProvider } from "quantumcoin";\nimport { ${a.contractName} } from "..";\n\nasync function main(): Promise<void> {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  const address = process.env.CONTRACT_ADDRESS;\n  if (!address) throw new Error("CONTRACT_ADDRESS is required");\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const contract = ${a.contractName}.connect(address, provider);\n\n  console.log("${a.contractName}:", contract.target);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );
        _writeText(
          path.join(outDir, "examples", `write-operations-${a.contractName}.ts`),
          `import { Initialize } from "quantumcoin/config";\nimport { getProvider } from "quantumcoin";\nimport { createTestWallet } from "./_test-wallet";\nimport { ${a.contractName} } from "..";\n\nasync function main(): Promise<void> {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  const address = process.env.CONTRACT_ADDRESS;\n  if (!address) throw new Error("CONTRACT_ADDRESS is required");\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const wallet = createTestWallet(provider);\n  const contract = ${a.contractName}.connect(address, wallet);\n\n  console.log("Connected:", contract.target);\n  console.log("Done");\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );
        _writeText(
          path.join(outDir, "examples", `offline-signing-${a.contractName}.ts`),
          `import { Initialize } from "quantumcoin/config";\nimport { getProvider, Wallet, getCreateAddress } from "quantumcoin";\nimport { TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE } from "./_test-wallet";\nimport { ${a.contractName}__factory, ${a.contractName} } from "..";\n\nasync function main(): Promise<void> {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE);\n  const from = wallet.address;\n\n  const factory = new ${a.contractName}__factory(wallet);\n  const deployTxReq = factory.getDeployTransaction();\n  const nonce0 = await provider.getTransactionCount(from, "pending");\n  const predicted = getCreateAddress({ from, nonce: nonce0 });\n\n  const rawDeploy = await wallet.signTransaction({ ...deployTxReq, nonce: nonce0, chainId, gasLimit: 6_000_000 });\n  const sentDeploy = await provider.sendRawTransaction(rawDeploy);\n  await sentDeploy.wait(1, 600_000);\n\n  const contract = ${a.contractName}.connect(predicted, provider);\n  console.log("deployed at:", contract.target);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );
        _writeText(
          path.join(outDir, "examples", `events-${a.contractName}.ts`),
          `import { Initialize } from "quantumcoin/config";\nimport { getProvider } from "quantumcoin";\nimport { ${a.contractName} } from "..";\n\nasync function main(): Promise<void> {\n  const rpcUrl = process.env.QC_RPC_URL;\n  if (!rpcUrl) throw new Error("QC_RPC_URL is required");\n  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;\n  const address = process.env.CONTRACT_ADDRESS;\n  if (!address) throw new Error("CONTRACT_ADDRESS is required");\n  await Initialize(null);\n\n  const provider = getProvider(rpcUrl, chainId);\n  const contract = ${a.contractName}.connect(address, provider);\n\n  const logs = await contract.queryFilter("Transfer", "latest", "latest");\n  console.log("Logs:", logs.length);\n}\n\nmain().catch((e) => { console.error(e); process.exitCode = 1; });\n`,
        );
      }
    }

    // Add examples scripts and tsx devDependency so TS examples can run
    const pkgPath = path.join(outDir, "package.json");
    const pkg = _readJson(pkgPath);
    pkg.scripts = pkg.scripts || {};
    if (artifacts.length === 1) {
      pkg.scripts.examples = "node examples/deploy.js && node examples/read-operations.js && node examples/write-operations.js && node examples/offline-signing.js && node examples/events.js";
      pkg.scripts["examples:ts"] = "npx tsx examples/deploy.ts && npx tsx examples/read-operations.ts && npx tsx examples/write-operations.ts && npx tsx examples/offline-signing.ts && npx tsx examples/events.ts";
    } else {
      const tsParts = [];
      for (const a of artifacts) {
        tsParts.push(`npx tsx examples/deploy-${a.contractName}.ts`, `npx tsx examples/read-operations-${a.contractName}.ts`, `npx tsx examples/write-operations-${a.contractName}.ts`, `npx tsx examples/offline-signing-${a.contractName}.ts`, `npx tsx examples/events-${a.contractName}.ts`);
      }
      pkg.scripts["examples:ts"] = tsParts.join(" && ");
    }
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies.tsx = "^4.7.0";
    _writeJson(pkgPath, pkg);

    // Write an index.js re-export shim, then install and run build scripts.
    _writeText(path.join(outDir, "index.js"), _renderPackageIndexJs({ artifacts, entryDir: lang === "ts" ? "dist" : "src" }));
  }

  // Final step: after package creation, emit types.
  if (createPackage) {
    _runNpm(["install", "--no-fund", "--no-audit"], outDir);
    if (lang === "ts") {
      _runNpm(["run", "build:ts"], outDir);
    }
  }

  console.warn("This is an experimental SDK. Use at your own risk.");
  console.log(`Generated contract files in: ${targetSrcDir}`);
}

function _cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function _abiParamSig(p, { includeName = true } = {}) {
  if (!p || typeof p !== "object") return "";
  const t = typeof p.type === "string" ? p.type : "";
  const n = includeName && typeof p.name === "string" && p.name ? ` ${p.name}` : "";
  const indexed = p.indexed ? " indexed" : "";
  return `${t}${indexed}${n}`.trim();
}

function _abiFnSig(f) {
  const inputs = (f.inputs || []).map((p) => _abiParamSig(p)).filter(Boolean).join(", ");
  const outputs = (f.outputs || []).map((p) => _abiParamSig(p, { includeName: false })).filter(Boolean).join(", ");
  const mut = f.stateMutability && f.stateMutability !== "nonpayable" ? ` ${f.stateMutability}` : "";
  const returns = outputs ? ` returns (${outputs})` : "";
  return `${f.name}(${inputs})${mut}${returns}`.trim();
}

function _abiEventSig(e) {
  const inputs = (e.inputs || []).map((p) => _abiParamSig(p)).filter(Boolean).join(", ");
  return `${e.name}(${inputs})`.trim();
}

function _abiErrorSig(er) {
  const inputs = (er.inputs || []).map((p) => _abiParamSig(p)).filter(Boolean).join(", ");
  return `${er.name}(${inputs})`.trim();
}

function _firstLine(s) {
  if (!s) return "";
  const t = String(s).trim();
  if (!t) return "";
  return t.split(/\r?\n/g)[0].trim();
}

function _packageReadme({ pkgName, pkgDesc, artifacts, createdFromSolidity, lang = "ts" }) {
  const outLang = _normalizeLang(lang);
  const srcExt = outLang === "js" ? "js" : "ts";
  const list = (artifacts || []).map((a) => a.contractName).filter(Boolean);
  const hasMultiple = list.length > 1;

  const contractLinks = list.length
    ? list.map((n) => `- [\`${n}\`](#${n.toLowerCase()})`).join("\n")
    : "- (none)";

  const envBlock = `- \`QC_RPC_URL\` (required for transactional tests)\n- \`QC_CHAIN_ID\` (optional; defaults are used if omitted)\n`;

  const commonExamples = hasMultiple
    ? `Examples are generated per contract (e.g. \`examples/deploy-<Contract>.js\`).`
    : `- [deploy](./examples/deploy.js)\n- [read operations](./examples/read-operations.js)\n- [write operations](./examples/write-operations.js)\n- [events](./examples/events.js)\n`;

  const contractsMd = (artifacts || [])
    .map((a) => {
      const name = a.contractName;
      const desc = a.docs && typeof a.docs.contract === "string" && a.docs.contract.trim() ? a.docs.contract.trim() : "";

      const fnDocs = (a.docs && a.docs.functions) || {};
      const abi = Array.isArray(a.abi) ? a.abi : [];
      const functions = abi.filter((x) => x && x.type === "function").sort((x, y) => String(x.name).localeCompare(String(y.name)));
      const events = abi.filter((x) => x && x.type === "event").sort((x, y) => String(x.name).localeCompare(String(y.name)));
      const errors = abi.filter((x) => x && x.type === "error").sort((x, y) => String(x.name).localeCompare(String(y.name)));
      const ctor = abi.find((x) => x && x.type === "constructor");

      const examples = hasMultiple
        ? `- [deploy](./examples/deploy-${name}.js)\n- [read operations](./examples/read-operations-${name}.js)\n- [write operations](./examples/write-operations-${name}.js)\n- [events](./examples/events-${name}.js)\n`
        : `- [deploy](./examples/deploy.js)\n- [read operations](./examples/read-operations.js)\n- [write operations](./examples/write-operations.js)\n- [events](./examples/events.js)\n`;

      const testLink = `- [transactional test](./test/e2e/${name}.e2e.test.js)\n`;

      const fileLinks = [
        `- [\`src/${name}.${srcExt}\`](./src/${name}.${srcExt})`,
        `- [\`src/${name}__factory.${srcExt}\`](./src/${name}__factory.${srcExt})`,
        createdFromSolidity ? `- [\`artifacts/${name}.abi.json\`](./artifacts/${name}.abi.json)` : null,
        createdFromSolidity ? `- [\`artifacts/${name}.bin\`](./artifacts/${name}.bin)` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const ctorSig = ctor
        ? `\`constructor(${(ctor.inputs || []).map((p) => _abiParamSig(p)).filter(Boolean).join(", ")})\``
        : "`constructor()`";

      const fnList = functions.length
        ? functions
            .map((f) => {
              const doc = fnDocs && typeof fnDocs[f.name] === "string" ? _firstLine(fnDocs[f.name]) : "";
              return `- \`${_abiFnSig(f)}\`${doc ? ` — ${doc}` : ""}`;
            })
            .join("\n")
        : "- (none)";

      const eventList = events.length ? events.map((e) => `- \`${_abiEventSig(e)}\``).join("\n") : "- (none)";
      const errorList = errors.length ? errors.map((er) => `- \`${_abiErrorSig(er)}\``).join("\n") : "- (none)";

      return [
        `## ${name}`,
        desc ? `\n${desc}\n` : "",
        `- **Exports**: \`${name}\`, \`${name}__factory\``,
        `- **Constructor**: ${ctorSig}`,
        "",
        "### Files",
        fileLinks,
        "",
        "### Examples",
        examples.trimEnd(),
        "",
        "### Tests",
        testLink.trimEnd(),
        "",
        "### Functions",
        fnList,
        "",
        "### Events",
        eventList,
        "",
        "### Errors",
        errorList,
        "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return (
    `# ${pkgName}\n\n` +
    `${pkgDesc || ""}\n\n` +
    "> **Note:** This is an experimental SDK. Use at your own risk.\n\n" +
    "## What’s in this package\n\n" +
    (outLang === "ts"
      ? "- Typed contract wrappers and factories in `src/` (compiled output in `dist/`)\n"
      : "- JavaScript contract wrappers and factories in `src/` (TypeScript types via `.d.ts`)\n") +
    "- Transactional tests in `test/e2e/`\n" +
    `- Example scripts in \`examples/\`\n` +
    (createdFromSolidity ? "- ABI/BIN artifacts in `artifacts/`\n" : "") +
    "\n" +
    "## Install\n\n" +
    "- `npm install`\n\n" +
    "## Build\n\n" +
    (outLang === "ts" ? "- `npm run build:ts`\n\n" : "- (no build step required)\n\n") +
    "## Run tests\n\n" +
    "- `npm test`\n\n" +
    "Transactional tests require:\n" +
    envBlock +
    "\n" +
    "## Examples\n\n" +
    (hasMultiple ? `${commonExamples}\n\n` : `${commonExamples}\n`) +
    "## Contracts\n\n" +
    contractLinks +
    "\n\n" +
    (contractsMd ? contractsMd : "") +
    "\n"
  );
}

function _createPackageScaffold({ outDir, pkgName, pkgDesc, pkgAuthor, pkgLicense, pkgVersion, lang = "ts" }) {
  _ensureDir(outDir);
  _ensureDir(path.join(outDir, "src"));
  _ensureDir(path.join(outDir, "test", "e2e"));
  _ensureDir(path.join(outDir, "examples"));

  const outLang = _normalizeLang(lang);
  const isTs = outLang === "ts";

  // The generated SDK only imports from "quantumcoin" (and "quantumcoin/config").
  // quantum-coin-js-sdk and seed-words are pulled in transitively via quantumcoin,
  // so we intentionally do NOT copy them as direct dependencies here — the
  // generated package.json lists only the minimum it actually needs.
  const dependencies = {
    quantumcoin: `file:${__dirname.replace(/\\\\/g, "/")}`,
  };

  const pkgJson = {
    name: pkgName,
    version: pkgVersion,
    description: pkgDesc,
    author: pkgAuthor,
    license: pkgLicense,
    main: isTs ? "dist/index.js" : "src/index.js",
    types: isTs ? "dist/index.d.ts" : "src/index.d.ts",
    scripts: {
      ...(isTs
        ? {
            "build:ts": "npx -p typescript tsc -p tsconfig.json",
            build: "npm run build:ts",
            "build-powershell": "npm run build:ts",
            test: "npm run build:ts && node --test --test-concurrency=1 \"test/**/*.test.js\"",
            "test:e2e": "npm run build:ts && node --test --test-concurrency=1 \"test/e2e/**/*.test.js\"",
          }
        : {
            build: "node -e \"console.log('JS package: no build step required')\"",
            "build-powershell": "node -e \"console.log('JS package: no build step required')\"",
            test: "node --test --test-concurrency=1 \"test/**/*.test.js\"",
            "test:e2e": "node --test --test-concurrency=1 \"test/e2e/**/*.test.js\"",
          }),
    },
    dependencies,
    devDependencies: {},
  };

  _writeJson(path.join(outDir, "package.json"), pkgJson);
  if (isTs) {
    _writeJson(path.join(outDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022"],
        module: "CommonJS",
        declaration: true,
        rootDir: "src",
        outDir: "dist",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ["src/**/*.ts"],
    });
  }

  _writeText(
    path.join(outDir, "README.md"),
    _packageReadme({ pkgName, pkgDesc, artifacts: [], createdFromSolidity: false, lang: outLang }),
  );

  _writeText(path.join(outDir, ".gitignore"), `node_modules\n/dist\n*.log\n`);

  // Provide a root index.d.ts without needing a separate build step.
  // This is mainly for convenience and for tooling that expects a top-level .d.ts.
  _writeText(path.join(outDir, "index.d.ts"), `export * from "./${isTs ? "dist" : "src"}";\n`);

  // Minimal shims so the generated TypeScript can compile even though `quantumcoin`
  // is a JavaScript package (no bundled .d.ts in this repo).
  _writeText(
    path.join(outDir, "src", "quantumcoin-shims.d.ts"),
    `declare module "quantumcoin" {\n` +
      `  export type ContractRunner = any;\n` +
      `  export type TransactionResponse = any;\n` +
      `  export type ContractTransactionResponse = any;\n` +
      `  export type TransactionRequest = any;\n` +
      `\n` +
      `  export class Contract {\n` +
      `    constructor(address: string, abi: any, runner?: any, bytecode?: any);\n` +
      `    target: string;\n` +
      `    address: string;\n` +
      `    interface: any;\n` +
      `    populateTransaction: any;\n` +
      `    call(methodName: string, args: any[], overrides?: TransactionRequest): Promise<any>;\n` +
      `    send(methodName: string, args: any[], overrides?: TransactionRequest): Promise<ContractTransactionResponse>;\n` +
      `    deployTransaction(): TransactionResponse | null;\n` +
      `  }\n` +
      `\n` +
      `  export class ContractFactory {\n` +
      `    signer: any;\n` +
      `    constructor(abi: any, bytecode: string, signer: any);\n` +
      `    getDeployTransaction(...args: any[]): TransactionRequest;\n` +
      `  }\n` +
      `\n` +
      `  export function getCreateAddress(opts: { from: string; nonce: number }): string;\n` +
      `}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

