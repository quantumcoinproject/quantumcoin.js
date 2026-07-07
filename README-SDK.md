> **CAUTION:** This is an experimental SDK. Use at your own risk.

# QuantumCoin.js — Comprehensive SDK Documentation

This document is the **complete, detailed SDK reference** for QuantumCoin.js (ethers.js v6-compatible surface), including **every exported class/function**, their **parameters**, and links to **examples** and **tests** in this repository.

> Reminder: QuantumCoin.js requires calling `Initialize()` before using features that depend on `quantum-coin-js-sdk` (address validation, ABI encoding/decoding, signing, etc.).

## Table of Contents

- [Getting started](#getting-started)
  - [Install](#install)
  - [Initialization (required)](#initialization-required)
  - [Key differences vs ethers/Ethereum](#key-differences-vs-ethersethereum)
  - [Platform support (Node.js and browser)](#platform-support-nodejs-and-browser)
- [Configuration (`quantumcoin/config`)](#configuration-quantumcoinconfig)
  - [`Config`](#config)
  - [`Initialize(config)`](#initializeconfig)
  - [`isInitialized()`](#isinitialized)
  - [`getConfig()`](#getconfig)
- [Constants](#constants)
- [Errors](#errors)
  - [`makeError`, `assert`, `assertArgument`, `isError`, `isCallException`](#makeerror-assert-assertargument-iserror-iscallexception)
  - [`ProviderError`, `TransactionError`, `ContractError`](#providererror-transactionerror-contracterror)
- [Providers](#providers)
  - [`Provider`](#provider)
  - [`AbstractProvider`](#abstractprovider)
  - [`JsonRpcProvider` / `JsonRpcApiProvider`](#jsonrpcprovider--jsonrpcapiprovider)
  - [`WebSocketProvider`](#websocketprovider)
  - [`IpcSocketProvider`](#ipcsocketprovider)
  - [`BrowserProvider`](#browserprovider)
  - [`FallbackProvider`](#fallbackprovider)
  - [`FilterByBlockHash`](#filterbyblockhash)
  - [`Block`](#block)
  - [`TransactionResponse`](#transactionresponse)
  - [`TransactionReceipt`](#transactionreceipt)
  - [`Log`](#log)
- [Wallets & Signers](#wallets--signers)
  - [`SigningKey`](#signingkey)
  - [`AbstractSigner`](#abstractsigner)
  - [`BaseWallet`](#basewallet)
  - [`Wallet`](#wallet)
  - [`NonceManager`](#noncemanager)
  - [`JsonRpcSigner`](#jsonrpcsigner)
  - [`VoidSigner`](#voidsigner)
- [Contracts](#contracts)
  - [`Contract`](#contract)
  - [`ContractFactory`](#contractfactory)
  - [`ContractTransactionResponse`](#contracttransactionresponse)
  - [`ContractTransactionReceipt`](#contracttransactionreceipt)
  - [`EventLog`](#eventlog)
- [ABI](#abi)
  - [Fragments (`Fragment`, `FunctionFragment`, ...)](#fragments-fragment-functionfragment-)
  - [`Interface`](#interface)
  - [`AbiCoder`](#abicoder)
- [Utilities](#utilities)
  - [Address utilities](#address-utilities)
  - [Encoding utilities](#encoding-utilities)
  - [Hashing utilities](#hashing-utilities)
  - [Units](#units)
  - [RLP](#rlp)
  - [`Result` and `checkResultErrors`](#result-and-checkresulterrors)
- [Typed SDK Generator (`generate-sdk.js`)](#typed-sdk-generator-generate-sdkjs)
  - [Overview](#overview)
  - [Input modes](#input-modes)
  - [Package scaffolding mode](#package-scaffolding-mode)
  - [Generated package layout](#generated-package-layout)
  - [Running generated transactional tests](#running-generated-transactional-tests)
  - [Generator tests](#generator-tests)

## Getting started

### Install

```bash
npm install quantumcoin
```

### Initialization (required)

```js
const { Initialize } = require("quantumcoin/config");

// Initialize with defaults (chainId=123123 and default RPC endpoint)
await Initialize(null);
```

If you need to override the RPC endpoint used by `JsonRpcProvider` defaults:

```js
const { Config, Initialize } = require("quantumcoin/config");
await Initialize(new Config(123123, "https://public.rpc.quantumcoinapi.com"));
```

**Example(s):**
- `examples/example.js`

### Key differences vs ethers/Ethereum

- **Addresses are 32 bytes** (66 hex chars including `0x`)
- **Signing and ABI encoding/decoding** are delegated to `quantum-coin-js-sdk` (WASM)
- **Initialize must be called** once at startup for wallet/address/ABI helpers

### Platform support (Node.js and browser)

QuantumCoin.js is **platform agnostic** and runs in both Node.js (20+) and modern
browsers. It does **not** depend on Node's built-in `crypto` module: all
cryptographic primitives (`keccak256`, `sha256`, `sha512`, `ripemd160`,
`computeHmac`, `pbkdf2`, `scrypt`/`scryptSync`) are provided by
`quantum-coin-js-sdk` (WebAssembly), and `randomBytes` uses the standard Web
Crypto API (`globalThis.crypto`).

Because the crypto primitives come from `quantum-coin-js-sdk`, **the hashing and
KDF helpers require `Initialize()` to have completed** before use. Calling them
beforehand throws a `NOT_INITIALIZED` error:

```js
const qc = require("quantumcoin");
const { Initialize } = require("quantumcoin/config");

await Initialize(null);
qc.keccak256(qc.toUtf8Bytes("hello")); // ok after Initialize()
```

Notes for browser usage:

- Bundle your app with a browser bundler (esbuild, webpack, Vite, Rollup, etc.).
  `quantum-coin-js-sdk` ships its WASM embedded, so no extra asset fetching or
  `wasm_exec.js` wiring is required — just `require`/`import` the SDK and call
  `Initialize()`.
- The `IpcSocketProvider` (Unix domain socket / named pipe transport) is
  **Node-only**; it lazily loads `node:net` and throws `NOT_IMPLEMENTED` in the
  browser. `JsonRpcProvider` (via `fetch`), `WebSocketProvider` (via
  `globalThis.WebSocket`) and `BrowserProvider` (EIP-1193) all work in browsers.
  The package's `browser` field maps `node:net` to `false` so bundlers can drop
  the IPC code path.

The browser surface is validated by an automated headless-browser suite
(`npm run test:browser`, Playwright + esbuild).

## Configuration (`quantumcoin/config`)

### `Config`

**Constructor**

- `new Config(chainId?: number, rpcEndpoint?: string)`
  - **chainId**: defaults to `123123`
  - **rpcEndpoint**: defaults to `https://public.rpc.quantumcoinapi.com`

### `Initialize(config)`

- `Initialize(config: Config | null | undefined): Promise<boolean>`
  - If `config` is `null` / `undefined`, defaults are used
  - Initializes `quantum-coin-js-sdk` internally (WASM + crypto)

### `isInitialized()`

- `isInitialized(): boolean`
  - Returns true after `Initialize(...)` succeeds

### `getConfig()`

- `getConfig(): Config | null`
  - Returns the active config (or `null` if not initialized)

## Constants

Exported from `quantumcoin`:

- `version: string`
- `ZeroAddress: string` (32-byte zero address)
- `ZeroHash: string` (32-byte zero hash)
- `MaxUint256: bigint`
- `MaxUint160: bigint`
- `MinInt256: bigint`
- `MaxInt256: bigint`
- `NumericFault: string` (=`"NUMERIC_FAULT"`)
- `NumericFaultCode: string` (=`"NUMERIC_FAULT"`)
- `WeiPerEther: bigint` (=`1000000000000000000n`)
- `EtherSymbol: string` (=`"Ξ"`)
- `N: bigint` (compat placeholder)

## Errors

### `makeError`, `assert`, `assertArgument`, `isError`, `isCallException`

- `makeError(message: string, code: ErrorCode, info?: object): Error & { code, shortMessage }`
- `assert(check: any, message: string, code: ErrorCode, info?: object): void`
- `assertArgument(check: any, message: string, name: string, value: any): void`
- `isError(error: any, code: string): boolean`
- `isCallException(error: any): boolean`

**Notes**
- Most SDK errors are `Error`/`TypeError` with `.code` and `.shortMessage` (ethers-like).

### `ProviderError`, `TransactionError`, `ContractError`

- `new ProviderError(message: string, info?: object)`
- `new TransactionError(message: string, info?: object)`
- `new ContractError(message: string, info?: object)`

## Providers

### `Provider`

Base class extending Node’s `EventEmitter`. Used primarily for API surface parity.

### `AbstractProvider`

Base provider implementation. Subclasses implement `_perform`.

**Core method**
- `_perform(method: string, params?: any[]): Promise<any>` (**subclass responsibility**)

**Read operations**
- `getBlockNumber(): Promise<number>`
- `getBlock(blockNumber: number | "latest"): Promise<Block>`
- `getTransaction(txHash: string): Promise<TransactionResponse | null>`
- `getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null>`
- `getBalance(address: string): Promise<bigint>`
- `getTransactionCount(address: string, blockTag?: string | null): Promise<number>`
- `call(tx: TransactionRequest, blockTag?: string | null): Promise<string>`
- `estimateGas(tx: TransactionRequest): Promise<bigint>`
- `getFeeData(walletOrKeyType: Wallet | number, fullSign?: boolean | null): Promise<FeeData>` — returns fee data for a wallet (its key type is read via `getKeyType()`) or for a key type number (`3` or `5`) passed directly. `fullSign` applies only to key type `3` (full signing costs more gas) and is ignored for key type `5`. `FeeData` currently exposes a single field `gasPrice: bigint`, the price **per unit of gas** in wei (so the total transaction fee is `gasPrice * gasLimit`). Only DynamicFeeTx (dynamic-fee) transactions are supported; the EIP-1559 fields `maxFeePerGas` / `maxPriorityFeePerGas` are **not supported yet** (QuantumCoin has no base-fee / priority-tip model) and are absent from `FeeData`. Like ethers, this is a provider method; later releases may issue a network call (hence the `Promise`).
- `getCode(address: string, blockTag?: string | null): Promise<string>`
- `getStorageAt(address: string, position: bigint, blockTag?: string | null): Promise<string>`
- `getLogs(filter: Filter | FilterByBlockHash): Promise<Log[]>`

> **JSON-RPC QUANTITY formatting:** numeric block-tag arguments to `getBlock(n)` and `getLogs({ fromBlock: n, toBlock: n })` are encoded as spec-compliant QUANTITY hex strings — no leading zeros, with `0` encoded as `"0x0"`. This matches the [Ethereum JSON-RPC convention](https://ethereum.org/en/developers/docs/apis/json-rpc/#conventions) (e.g. `getBlock(5)` sends `"0x5"`, not `"0x05"`), so requests to spec-compliant nodes succeed for block numbers in `[1..15]`, `[256..4095]`, etc. The internal helper used is [`toQuantityHex`](./src/internal/hex.js) (aliased as `toQuantity`), which is the QuantumCoin.js equivalent of ethers.js v6 `toQuantity`. Use `normalizeHex` for **DATA** hex (addresses, bytecode, byte-arrays); use `toQuantityHex` for **QUANTITY** hex (block numbers, gas, nonces, balances).

**Write operation**
- `sendTransaction(tx: string | { raw: string }): Promise<TransactionResponse>`
  - QuantumCoin.js expects a **signed raw transaction hex string**.

**Example(s):**
- `examples/example.js`
- `examples/read-operations.js`
- `examples/events.js`

### `JsonRpcProvider` / `JsonRpcApiProvider`

HTTP JSON-RPC provider.

- `new JsonRpcProvider(url?: string, chainId?: number)`
  - If `url` is omitted, uses config default `rpcEndpoint`
  - If `chainId` is omitted, defaults to `123123`

**Example(s):**
- `examples/example.js`

### `WebSocketProvider`

WebSocket JSON-RPC provider (no extra dependencies; uses Node’s global `WebSocket`).

- `new WebSocketProvider(url: string, chainId?: number)`
- `destroy(): void` (closes socket, rejects pending requests)

**Test(s):**
- `test/integration/ws-provider.test.js`

### `IpcSocketProvider`

IPC JSON-RPC provider using Node’s `net`.

- `new IpcSocketProvider(path: string)`
  - Windows example: `\\\\.\\pipe\\geth.ipc`

**Test(s):**
- `test/integration/ipc-provider.test.js`

### `BrowserProvider`

EIP-1193 wrapper provider (for injected browser wallets).

- `new BrowserProvider(eip1193Provider: { request: Function }, network?: any, options?: BrowserProviderOptions)`
  - `providerInfo` is supported as an option (compat)

**Core methods**
- `send(method: string, params?: any[] | object): Promise<any>`
- `_send(payloadOrArray): Promise<any>` (compat)
- `_perform(method: string, params?: any[]): Promise<any>` (delegates to `send`)
- `getRpcError(payload, error): Error`
- `getSigner(addressOrIndex?: string | number): Promise<JsonRpcSigner>`
- `hasSigner(addressOrIndex: string | number): Promise<boolean>`

**Debug event sink**
- Emits `"debug"` events:
  - `{ action: "sendEip1193Payload", payload: { method, params } }`
  - `{ action: "receiveEip1193Result", result }`
  - `{ action: "receiveEip1193Error", error }`

**Test(s):**
- `test/unit/browser-provider.test.js`

Reference: ethers BrowserProvider docs: [`https://docs.ethers.org/v6/api/providers/#BrowserProvider`](https://docs.ethers.org/v6/api/providers/#BrowserProvider)

### `FallbackProvider`

Simple provider wrapper that tries multiple providers in order.

- `new FallbackProvider(providers: AbstractProvider | AbstractProvider[])`
- `_perform(method, params)` tries each provider until one succeeds

### `FilterByBlockHash`

Helper for filters pinned to a specific block hash (ethers style).

- `new FilterByBlockHash(blockHash: string, address?: string | string[], topics?: (string|string[]|null)[])`
  - `blockHash` must be **32-byte hex**
  - `toJSON()` returns `{ blockHash, address, topics }`

**Test(s):**
- `test/unit/filter-by-blockhash.test.js`

Reference: ethers FilterByBlockHash docs: [`https://docs.ethers.org/v6/api/providers/#FilterByBlockHash`](https://docs.ethers.org/v6/api/providers/#FilterByBlockHash)

### `Block`

Wrapper returned by `provider.getBlock(...)`.

**Properties**
- `hash: string | null`
- `parentHash: string | null`
- `number: number | null`
- `timestamp: number | null`
- `transactions: any[]`
- `provider: AbstractProvider | null`

**Methods**
- `getTransaction(indexOrHash: number | string): Promise<TransactionResponse | null>`
- `getTransactionReceipt(indexOrHash: number | string): Promise<TransactionReceipt | null>`
- `getPrefetchedTransactions(): any[]` (currently returns `[]`)

### `TransactionResponse`

Wrapper returned by `provider.sendTransaction(...)` and `provider.getTransaction(...)`.

**Properties (common)**
- `hash: string`
- `to: string | null`
- `from: string | null`
- `nonce: number | null`
- `data: string`
- `value: bigint`
- `gasLimit: bigint | null`
- `chainId: number | null`
- `blockNumber: number | null`
- `txType: number | null` — Transaction type (e.g. `1` for a standard transfer)
- `provider: AbstractProvider | null`

**Methods**
- `wait(confirmations?: number | null, timeoutMs?: number | null): Promise<TransactionReceipt>`

### `TransactionReceipt`

Wrapper returned by `provider.getTransactionReceipt(...)` and `tx.wait()`.

**Properties (common)**
- `to: string | null`
- `from: string | null`
- `contractAddress: string | null`
- `transactionHash: string`
- `blockHash: string`
- `blockNumber: number | null`
- `transactionIndex: number | null`
- `gasUsed: bigint | null`
- `status: number | null`
- `logs: Log[]`
- `provider: AbstractProvider | null`

### `Log`

Wrapper returned by `provider.getLogs(...)`.

**Properties (common)**
- `address: string`
- `topics: string[]`
- `data: string`
- `blockHash: string | null`
- `blockNumber: number | null`
- `transactionHash: string | null`
- `transactionIndex: number | null`
- `logIndex: number | null`
- `removed: boolean`
- `provider: AbstractProvider | null`

**Methods**
- `getBlock(): Promise<Block | null>`
- `getTransaction(): Promise<TransactionResponse | null>`
- `getTransactionReceipt(): Promise<TransactionReceipt | null>`

## Wallets & Signers

### `SigningKey`

- `new SigningKey(privateKeyBytes: Uint8Array, publicKeyBytes: Uint8Array)`

### `AbstractSigner`

- `new AbstractSigner(provider?: AbstractProvider | null)`
- `provider: AbstractProvider | null`
- `getAddress(): Promise<string>` (base throws; implemented by subclasses)

### `BaseWallet`

Core signing implementation.

- `new BaseWallet(signingKey: SigningKey, provider?: AbstractProvider | null, precomputed?: { address: string }, qcWallet?: any)`

**Properties**
- `address: string`
- `privateKey: string` (getter; hex string)
- `publicKey: string` (getter; hex string)
- `seed: string | null` (getter; pre-expansion seed as hex, or `null` if the wallet has no seed source)
- `provider: AbstractProvider | null`

**Methods**
- `getAddress(): Promise<string>`
- `signTransaction(tx: TransactionRequest): Promise<string>`
- `sendTransaction(tx: TransactionRequest): Promise<TransactionResponse>`
- `signMessageSync(message: string | Uint8Array, signingContext?: number | null): string` — signs an arbitrary message using the EIP-191 personal-message digest (see [Message signing](#message-signing-eip-191)). Returns an opaque post-quantum signature blob (0x hex) that embeds the signer's public key. The message may be at most 1 MiB once UTF-8 encoded (`INVALID_ARGUMENT` otherwise). Optional `signingContext`: omitted/`null` derives the compact context from the key type (`0` for keyType 3, `1` for keyType 5); `2` selects the full-signature scheme for a keyType 3 wallet.
- `signMessage(message: string | Uint8Array, signingContext?: number | null): Promise<string>` — async wrapper over `signMessageSync` (honors the ethers `Signer` interface contract; the underlying signing is synchronous).

### `Wallet`

User-facing wallet class.

- `new Wallet(privateKeyOrBytesOrSigningKey, provider?: AbstractProvider)`

**Static methods**
- `Wallet.createRandom(provider?: AbstractProvider, keyType?: number | null): Wallet` — `keyType`: `null`/`3` (default, hybrid compact) or `5` (hybrid5)
- `Wallet.fromSeed(seed: number[], provider?: AbstractProvider): Wallet` — opens wallet from raw seed bytes (64/72/96 length)
- `Wallet.fromEncryptedJsonSync(json: string, password: string, provider?: AbstractProvider): Wallet`
- `Wallet.fromPhrase(phrase: string | string[], provider?: AbstractProvider): Wallet`
- `Wallet.fromKeys(privateKey: Uint8Array | string, publicKey: Uint8Array | string, provider?: AbstractProvider): Wallet`
- `Wallet.encryptSeedSync(seed: number[] | Uint8Array, password: string | Uint8Array): string` — encrypts raw seed bytes (64/72/96) into a wallet JSON string (version 5 pre-expansion format). The resulting JSON can be opened with `fromEncryptedJsonSync()` or Desktop/Mobile/Web/CLI wallet applications. Password must be at least 12 characters.

**Instance methods**
- `getAddress(): string`
- `getBalance(blockTag?: string): Promise<bigint>`
- `getTransactionCount(blockTag?: string): Promise<number>`
- `encryptSync(password: string | Uint8Array): string`
- `connect(provider: AbstractProvider): Wallet`
- `getPhrase(): string[] | null` — returns the seed phrase (list of words) when the wallet has a seed, else `null`. Works for `createRandom`, `fromPhrase`, `fromSeed`, and `fromEncryptedJsonSync` on a version-5 keystore. Returns `null` for `fromKeys` and for v3/v4 keystores.
- `getSigningContext(fullSign?: boolean | null): number` — returns the recommended signing context for this wallet (based on public key type). Setting `fullSign` to `true` may incur additional gas cost.
- `getKeyType(): number` — returns the wallet's key type, derived from its public key length: `3` (HYBRIDEDMLDSASLHDSA) or `5` (HYBRIDEDMLDSASLHDSA5). The key type drives gas-price selection in `getFeeData`. Throws for an unsupported public key size.

**Seed & phrase applicability**

| Factory | `seed` | `getPhrase()` |
| --- | --- | --- |
| `new Wallet(privateKey)` | `null` | `null` |
| `Wallet.createRandom(provider?, keyType?)` | non-null | 32 or 36 words |
| `Wallet.fromPhrase(phrase)` | non-null | 32 / 36 / 48 words |
| `Wallet.fromSeed(seed)` | non-null | 32 / 36 / 48 words |
| `Wallet.fromKeys(priv, pub)` | `null` | `null` |
| `Wallet.fromEncryptedJsonSync(json, pw)` — v5 keystore (from `encryptSync` on seed-bearing wallet, or `encryptSeedSync`) | non-null | original words |
| `Wallet.fromEncryptedJsonSync(json, pw)` — v3 / v4 keystore | `null` | `null` |
| `wallet.connect(provider)` | same as source | same as source |

**Example(s):**
- `examples/wallet-offline.js`

### `NonceManager`

Signer wrapper to manage nonces.

- `new NonceManager(signer: AbstractSigner)`

**Methods**
- `getAddress(): Promise<string>`
- `getTransactionCount(blockTag?: string): Promise<number>`
- `sendTransaction(tx: TransactionRequest): Promise<any>`
- `reset(): void`
- `increment(): void`

### `JsonRpcSigner`

Lightweight signer placeholder used by `BrowserProvider.getSigner(...)`.

- `new JsonRpcSigner(provider, address)`
- `getAddress(): Promise<string>`

### `VoidSigner`

Address-only signer.

- `new VoidSigner(address: string, provider?: AbstractProvider)`
- `getAddress(): Promise<string>`

### Message signing (EIP-191)

Arbitrary-message signing and verification, adapted from ethers for
QuantumCoin's post-quantum cryptography.

- `Wallet.signMessage(message, signingContext?)` / `Wallet.signMessageSync(message, signingContext?)` — see [`BaseWallet`](#basewallet).
- `hashMessage(message: string | Uint8Array): string` — the EIP-191 digest,
  `keccak256("\x19Ethereum Signed Message:\n" + len + message)` (32 bytes). Same
  prefix as Ethereum, so it matches `personal_sign` in `quantum-coin-go`. Strings
  are UTF-8 encoded; the length prefix counts message **bytes**.
- `verifyMessage(message: string | Uint8Array, signature: string | Uint8Array): string`
  — **synchronous** (matches ethers; there is no `verifyMessageSync`). Returns the
  recovered 32-byte signer address; throws `INVALID_ARGUMENT` if the signature is
  malformed or does not verify.

```js
const { Wallet, verifyMessage } = require("quantumcoin");
const wallet = Wallet.createRandom();
const sig = await wallet.signMessage("Hello Joe");
verifyMessage("Hello Joe", sig) === wallet.address; // true
```

**Key differences vs Ethereum**

| Property | Ethereum | QuantumCoin |
| --- | --- | --- |
| Message prefix / hash | EIP-191 + keccak256 | Identical EIP-191 + keccak256 |
| Signature | 65-byte `(r, s, v)` | Opaque multi-KB blob (scheme id byte + **embedded public key**) |
| Address size | 20 bytes | 32 bytes |
| Recovery | ECDSA `ecrecover` | Extract embedded public key + PQC verify (no `ecrecover`) |
| `signTypedData` (EIP-712) | Supported | Not yet supported |

## Contracts

### `Contract`

Dynamic contract wrapper (ethers-like).

- `new Contract(address: string, abi: any[] | Interface, runner?: AbstractProvider | Wallet, bytecode?: string)`

**Properties**
- `address: string`
- `target: string` (alias of address)
- `interface: Interface`
- `provider: AbstractProvider | null`
- `signer: any | null`

**Call / send**
- `call(methodName: string, args: any[], overrides?: TransactionRequest): Promise<any>`
- `send(methodName: string, args: any[], overrides?: TransactionRequest): Promise<ContractTransactionResponse>`

**Logs / events**
- `queryFilter(eventName: string, fromBlock?: number|string, toBlock?: number|string): Promise<EventLog[]>`
- `on(eventName: string, callback: Function): this`
- `once(eventName: string, callback: Function): this`
- `removeListener(eventName: string, callback: Function): this`
- `removeAllListeners(eventName?: string): this`

**Deployment helpers**
- `deployTransaction(): any | null`
- `waitForDeployment(): Promise<this>`
- `getDeployedCode(): Promise<string | null>`

**Example(s):**
- `examples/read-operations.js`
- `examples/events.js`

### `ContractFactory`

Deployment helper.

- `new ContractFactory(abi: any[] | Interface, bytecode: string, signer: any)`

**Methods**
- `getDeployTransaction(...args: any[]): TransactionRequest`
- `deploy(...args: any[]): Promise<Contract>`
- `attach(address: string): Contract`
- `connect(signer: any): ContractFactory`

### `ContractTransactionResponse`

Wrapper around an underlying `TransactionResponse`.

- `wait(confirmations?: number, timeoutMs?: number): Promise<any>`
- `getTransaction(): any`

### `ContractTransactionReceipt`

Wrapper around a receipt with convenience filters.

- `getEvent(eventName: string): any | null`
- `getEvents(eventName: string): any[]`

### `EventLog`

Lightweight log wrapper returned by `Contract.queryFilter(...)`.

## ABI

### Fragments (`Fragment`, `FunctionFragment`, ...)

Exported fragment types:
- `Fragment`
- `NamedFragment`
- `FunctionFragment`
- `EventFragment`
- `ErrorFragment`
- `ConstructorFragment`
- `StructFragment`
- `FallbackFragment`

All fragments support:
- `format(format?: string | null): string`
- `toJSON(): any`

### `Interface`

ABI encoding/decoding compatibility layer.

- `new Interface(abi: any[] | Interface | null)`

**Methods**
- `formatJson(): string`
- `format(format?: string | null): string`
- `getFunction(name: string): FunctionFragment`
- `getEvent(name: string): EventFragment`
- `getError(name: string): ErrorFragment`
- `getConstructor(): ConstructorFragment | null`

**Encoding**
- `encodeFunctionData(functionFragmentOrName, values?: any[] | null): string`
- `decodeFunctionResult(functionFragmentOrName, data: string): any`
- `encodeEventLog(eventFragmentOrName, values?: any[] | null): { topics: string[], data: string }`
- `decodeEventLog(eventFragmentOrName, topics: string[], data: string): any`

**Parsing**
- `parseLog(log: { topics: string[], data: string }): { fragment, name, signature, topic, args }`
  - Uses signature topic matching and `decodeEventLog(...)`

### `AbiCoder`

Minimal ABI coder for encoding/decoding tuples of values.

- `encode(types: (string|any)[], values: any[]): string`
- `decode(types: (string|any)[], data: string): any`
- `getDefaultValue(types: (string|any)[]): any`

## Utilities

### Address utilities

From `quantumcoin`:

- `isAddress(address: string): boolean`
- `getAddress(address: string): string`
- `isAddressable(value: any): boolean`
- `resolveAddress(target: any): string | Promise<string>`
- `getContractAddress({ from, nonce }): string`
- `getCreateAddress({ from, nonce }): string`
- `getCreate2Address(from: string, salt: string, initCodeHash: string): string`
- `computeAddress(publicKey: string|Uint8Array): string`

**Example(s):**
- `examples/wallet-offline.js`

## Solidity Types (TypeScript)

QuantumCoin.js exposes core Solidity-related types for TypeScript users.

- **Import path**: `quantumcoin/types`

**Key exports**

- `AddressLike` (currently `string`, 32-byte address)
- `BytesLike` (`string | Uint8Array`)
- `BigNumberish` (`string | number | bigint`)
- `SolidityTypeName` (ABI type string model)
- **Hard Solidity aliases** (preferred for typed wrappers):
  - Integers: `Uint256Like` / `Uint256`, `Int256Like` / `Int256` (and all widths `Uint8Like`…`Uint256Like`, `Int8Like`…`Int256Like`)
  - Fixed bytes: `Bytes32Like` / `Bytes32` (and `Bytes1Like`…`Bytes32Like`)
  - Arrays/tuples helpers: `SolArray<T>`, `SolFixedArray<T, N>`, `SolStruct<T>`
- `SolidityInputValue<T>` / `SolidityOutputValue<T>` (advanced type-level mapping from ABI type strings to JS values; the generator no longer uses these for wrapper signatures)

Example:

```ts
import type { AddressLike, BigNumberish, Uint256Like, Uint256 } from "quantumcoin/types";

const to: AddressLike = "0x0000000000000000000000000000000000000000000000000000000000001000";
const amount: BigNumberish = "123";
const asInput: Uint256Like = amount;
const asOutput: Uint256 = 123n;
```

### Encoding utilities

- `toUtf8String(data: BytesLike): string`
- `toUtf8Bytes(str: string): Uint8Array`
- `toHex(data: BytesLike): string`
- `hexlify(data: BytesLike): string`
- `arrayify(data: BytesLike): Uint8Array`
- `isBytesLike(value: any): boolean`
- `concat(items: BytesLike[]): string`
- `stripZerosLeft(data: BytesLike): string`
- `zeroPad(value: BytesLike, length: number): string`
- `zeroPadValue(value: BytesLike, length: number): string`
- `encodeBytes32String(text: string): string`
- `decodeBytes32String(bytes: BytesLike): string`
- `encodeBase64(data: BytesLike): string`
- `decodeBase64(data: string): Uint8Array`
- `encodeBase58(data: BytesLike): string`
- `decodeBase58(data: string): Uint8Array`
- `toUtf8CodePoints(str: string): number[]`
- `solidityPacked(...)` (**throws; not implemented**)
- `solidityPackedKeccak256(...)` (**throws; not implemented**)
- `solidityPackedSha256(...)` (**throws; not implemented**)

### Hashing utilities

- `keccak256(data: BytesLike): string`
- `sha256(data: BytesLike): string`
- `sha512(data: BytesLike): string`
- `ripemd160(data: BytesLike): string`
- `id(text: string): string` (=`keccak256(utf8Bytes(text))`)
- `hashMessage(message: BytesLike): string` — EIP-191 personal-message digest, `keccak256("\x19Ethereum Signed Message:\n" + len + message)`. See [Message signing](#message-signing-eip-191).
- `randomBytes(length: number): Uint8Array`
- `computeHmac(algorithm: string, key: BytesLike, data: BytesLike): string`
- `pbkdf2(password: BytesLike, salt: BytesLike, iterations: number, keylen: number, algorithm?: string): string`
- `scrypt(password: BytesLike, salt: BytesLike, N: number, r: number, p: number, dkLen: number): Promise<string>`
- `scryptSync(password: BytesLike, salt: BytesLike, N: number, r: number, p: number, dkLen: number): string`

> These helpers are backed by `quantum-coin-js-sdk` (WASM) and therefore require
> `Initialize()` to have completed first; otherwise they throw a
> `NOT_INITIALIZED` error. `computeHmac` and `pbkdf2` support the `"sha256"`
> (default) and `"sha512"` algorithms. `randomBytes` uses the Web Crypto API and
> works without initialization.

### Units

- `formatUnits(value: BigNumberish, decimals?: number): string`
- `parseUnits(value: string, decimals?: number): bigint`
- `formatEther(value: BigNumberish): string`
- `parseEther(value: string): bigint`

### FixedNumber (fixed-point arithmetic)

Fixed-point decimal arithmetic compatible with ethers.js v5/v6.

**FixedFormat type:**
`number | string | { signed?: boolean, width?: number, decimals?: number }`

Default format: `"fixed128x18"` (signed, 128-bit, 18 decimals).

**Static factories:**
- `FixedNumber.fromString(value: string, format?: FixedFormat): FixedNumber`
- `FixedNumber.fromValue(value: BigNumberish, decimals?: number, format?: FixedFormat): FixedNumber`
- `FixedNumber.fromBytes(value: BytesLike, format?: FixedFormat): FixedNumber`
- `FixedNumber.from(value: any, format?: FixedFormat): FixedNumber` — dispatches to `fromString`, `fromBytes`, or `fromValue`
- `FixedNumber.isFixedNumber(value: any): boolean`

**Properties (read-only):**
- `format: string` — e.g. `"fixed128x18"`
- `signed: boolean`
- `width: number`
- `decimals: number`
- `value: bigint` — raw internal integer

**Arithmetic (safe throws on overflow, unsafe wraps silently):**
- `add(other)` / `addUnsafe(other): FixedNumber`
- `sub(other)` / `subUnsafe(other): FixedNumber`
- `mul(other)` / `mulUnsafe(other): FixedNumber`
- `div(other)` / `divUnsafe(other): FixedNumber`
- `mulSignal(other): FixedNumber` — throws on precision loss
- `divSignal(other): FixedNumber` — throws on precision loss

**Comparison:**
- `cmp(other): number` — returns `-1`, `0`, or `1`
- `eq(other)`, `lt(other)`, `lte(other)`, `gt(other)`, `gte(other): boolean`

**Rounding:**
- `floor(): FixedNumber`
- `ceiling(): FixedNumber`
- `round(decimals?: number): FixedNumber`

**Inspection:**
- `isZero(): boolean`
- `isNegative(): boolean`

**Conversion:**
- `toString(): string`
- `toUnsafeFloat(): number`
- `toFormat(format: FixedFormat): FixedNumber`
- `toHexString(width?: number): string`

### RLP

- `encodeRlp(value: any): string`
- `decodeRlp(data: string): any`

### `Result` and `checkResultErrors`

- `class Result extends Array`
  - `new Result(items?: any[], keys?: (null|string)[])`
  - `Result.fromItems(items: any[], keys?: (null|string)[]): Result`
  - `getValue(name: string): any`
  - `toArray(deep?: boolean | null): any[]`
  - `toObject(deep?: boolean | null): Record<string, any>`
- `checkResultErrors(result: any): Array<{ error: Error, path: (string|number)[] }>`

## Typed SDK Generator (`generate-sdk.js`)

### Overview

`generate-sdk.js` creates **typed contract wrappers** for one or more contracts, and can optionally scaffold a complete npm package (with examples and transactional tests).

It supports generating:
- **TypeScript source** (`--lang ts`, default)
- **JavaScript source + TypeScript declarations** (`--lang js`)

**Typing behaviour (generated wrappers)**

- **Hard types**: wrapper signatures use concrete types from `quantumcoin/types` (e.g. `Uint256Like` for inputs, `Uint256` for outputs).
- **Single output unwrapping**: functions returning one value return the value directly (not `[value]`).
- **Multiple outputs**: returned as a tuple type (e.g. `Promise<[Uint256, Bool]>`).
- **No outputs**: `Promise<void>`.
- **Structs / tuples**: emitted as `export type <Name>Input` / `export type <Name>Output` and used in signatures.
- **JS typing**: JS output uses JSDoc types plus `.d.ts` files; TS users still get strong types.

**Entry point**
- `node generate-sdk.js ...`
- or `npx sdkgen ...` (when installed)

### Input modes

1) **ABI + BIN**

```bash
node generate-sdk.js --abi path/to/My.abi.json --bin path/to/My.bin --name MyContract --out ./out --non-interactive

# JS output
node generate-sdk.js --lang js --abi path/to/My.abi.json --bin path/to/My.bin --name MyContract --out ./out --non-interactive
```

2) **Solidity sources**

```bash
node generate-sdk.js --sol ".\\contracts\\A.sol,.\\contracts\\B.sol" --solc "c:\\solc\\solc.exe" --out ./out --non-interactive

# Pass additional solc args (example)
node generate-sdk.js --sol ".\\contracts\\A.sol" --solc "c:\\solc\\solc.exe" --solc-args "--via-ir --evm-version london" --out ./out --non-interactive
```

3) **Artifacts JSON (multi-contract ABI+BIN list)**

```bash
node generate-sdk.js --artifacts-json .\\artifacts.json --out .\\out --non-interactive
```

Example `artifacts.json`:

```json
[
  { "abi": "./Alpha.abi.json", "bin": "./Alpha.bin" },
  { "abi": "./Beta.abi.json", "bin": "./Beta.bin", "name": "Beta" },
  {
    "name": "Gamma",
    "abi": "[{\"type\":\"function\",\"name\":\"set\",\"stateMutability\":\"nonpayable\",\"inputs\":[{\"name\":\"value\",\"type\":\"uint256\"}],\"outputs\":[]}]",
    "bin": "0x6000600055..."
  }
]
```

### Package scaffolding mode

Use `--create-package` to create a full npm package (source, tests, examples, README).

```bash
node generate-sdk.js --artifacts-json .\\artifacts.json ^
  --lang ts ^
  --create-package --package-dir .\\tmp --package-name my-typed-package ^
  --package-description "My typed package" --package-author "me" ^
  --package-license MIT --package-version 0.0.1 ^
  --non-interactive
```

### Generated package layout

When `--create-package` is used, the generator produces:

- `src/` contract wrappers + factories
  - TS mode: `*.ts` (compiled output in `dist/` after `npm run build:ts`)
  - JS mode: `*.js` with `*.d.ts` types (no build step required)
- `test/e2e/*.e2e.test.js` per-contract transactional tests
- `examples/` deploy/read/write/events scripts
- `README.md` generated by the generator (includes ABI-derived API overview)
- `index.js` + `index.d.ts` (package entry shims)

**Interface contracts:** if a generated contract has empty bytecode (typically a Solidity `interface` whose `.bin` is empty, or any artifact whose `bytecode` is `null`/`undefined`/`""`/`"0x"`), the generated `test/e2e/<name>.e2e.test.js` will still deploy and validate the transaction receipt status, but will **not** assert that `provider.getCode(contract.target)` is non-empty — interfaces deploy with no runtime code by design. For concrete contracts (non-empty bytecode), the bytecode assertion is preserved. Detection is done by `_isInterfaceBytecode` in `src/generator/index.js` and is exercised by the unit tests and the `generator-interface.e2e.test.js` end-to-end test listed below.

### Running generated transactional tests

Generated package tests broadcast transactions and require:

- `QC_RPC_URL` (RPC endpoint)
- `QC_CHAIN_ID` (optional, default `123123`)

### Generator tests

- Unit tests:
  - `test/unit/generate-contract-cli.test.js`
  - `test/unit/generator.test.js`
  - `test/unit/generate-sdk-artifacts-json.test.js`
- E2E generator tests (transactional; require `QC_RPC_URL` and optionally `QC_CHAIN_ID`):
  - `test/e2e/typed-generator.e2e.test.js`
  - `test/e2e/simple-erc20.generated-sdks.e2e.test.js`
  - `test/e2e/all-solidity-types.generated-sdks.e2e.test.js`
  - `test/e2e/generator-interface.e2e.test.js` (verifies that the generated test for an interface contract passes against a real chain — no `provider.getCode(...)` bytecode assertion is emitted, and the deploy + receipt-status assertions succeed end-to-end)

