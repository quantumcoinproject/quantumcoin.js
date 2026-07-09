export class Interface {
    /**
     * @param {any[]|Interface} abi
     */
    constructor(abi: any[] | Interface);
    abi: any;
    _abiJson: string;
    _qcsdkAbi: any[];
    _qcsdkAbiJson: string;
    /**
     * Returns JSON format of ABI.
     * @returns {string}
     */
    formatJson(): string;
    /**
     * Internal: normalized ABI JSON for qcsdk.
     * @returns {string}
     */
    _qcsdkFormatJson(): string;
    /**
     * Internal: normalize argument values for qcsdk based on original ABI params.
     * @param {Array<any>} params
     * @param {Array<any>} values
     * @returns {Array<any>}
     */
    _qcsdkNormalizeValues(params: Array<any>, values: Array<any>): Array<any>;
    /**
     * Basic formatter (ethers supports multiple formats).
     * @param {string=} format
     * @returns {string}
     */
    format(format?: string | undefined): string;
    /**
     * Get a function fragment by bare name, canonical signature
     * (`name(type,...)`), or 4-byte selector (`0x` + 8 hex). Mirrors ethers.js v6.
     * @param {string} nameOrSignatureOrSelector
     * @returns {FunctionFragment}
     */
    getFunction(nameOrSignatureOrSelector: string): FunctionFragment;
    /**
     * Get an event fragment by bare name, canonical signature, or topic0
     * (`0x` + 64 hex). Mirrors ethers.js v6.
     * @param {string} nameOrSignatureOrTopic
     * @returns {EventFragment}
     */
    getEvent(nameOrSignatureOrTopic: string): EventFragment;
    /**
     * Get an error fragment by bare name, canonical signature, or 4-byte selector.
     * Mirrors ethers.js v6.
     * @param {string} nameOrSignatureOrSelector
     * @returns {ErrorFragment}
     */
    getError(nameOrSignatureOrSelector: string): ErrorFragment;
    /**
     * Returns the constructor fragment if present.
     * @returns {ConstructorFragment|null}
     */
    getConstructor(): ConstructorFragment | null;
    /**
     * Encode function data using quantum-coin-js-sdk.
     * @param {FunctionFragment|string} functionFragment
     * @param {any[]} values
     * @returns {string}
     */
    encodeFunctionData(functionFragment: FunctionFragment | string, values: any[]): string;
    /**
     * Encode ABI constructor arguments for a contract deployment (no selector).
     * Returns "0x" when the constructor takes no arguments. The caller appends
     * this to the creation bytecode. Mirrors ethers.js v6.
     * @param {any[]=} values
     * @returns {string}
     */
    encodeDeploy(values?: any[] | undefined): string;
    /**
     * Decode the calldata of a function call (4-byte selector + ABI-encoded
     * arguments), returning the decoded input arguments as a Result. The data's
     * selector must match the resolved function. Mirrors ethers.js v6.
     * @param {FunctionFragment|string} fragment
     * @param {string} data
     * @returns {Result}
     */
    decodeFunctionData(fragment: FunctionFragment | string, data: string): Result;
    /**
     * Decode function result using quantum-coin-js-sdk.
     * @param {FunctionFragment|string} functionFragment
     * @param {string} data
     * @returns {any}
     */
    decodeFunctionResult(functionFragment: FunctionFragment | string, data: string): any;
    /**
     * Encode an event log from values.
     * @param {EventFragment|any} eventFragment
     * @param {any[]} values
     * @returns {{ topics: string[], data: string }}
     */
    encodeEventLog(eventFragment: EventFragment | any, values: any[]): {
        topics: string[];
        data: string;
    };
    /**
     * Decode an event log.
     * @param {EventFragment|any} eventFragment
     * @param {string[]} topics
     * @param {string} data
     * @returns {any}
     */
    decodeEventLog(eventFragment: EventFragment | any, topics: string[], data: string): any;
    /**
     * Parse a transaction's calldata into its function + decoded arguments.
     * Resolves the function by the 4-byte selector in `tx.data`, decodes the
     * arguments from the real bytes, and reports `value` as a bigint. Mirrors
     * ethers.js v6 (returns a TransactionDescription-shaped object).
     * @param {{ data: string, value?: any }} tx
     * @returns {{ fragment: FunctionFragment, name: string, signature: string, selector: string, args: Result, value: bigint }}
     */
    parseTransaction(tx: {
        data: string;
        value?: any;
    }): {
        fragment: FunctionFragment;
        name: string;
        signature: string;
        selector: string;
        args: Result;
        value: bigint;
    };
    parseLog(...args: any[]): {
        fragment: EventFragment;
        name: any;
        signature: any;
        topic: string;
        args: Result;
    };
    /**
     * Parse custom-error return data into its error fragment + decoded arguments.
     * Resolves the error by the 4-byte selector in `data`. Mirrors ethers.js v6
     * (returns an ErrorDescription-shaped object).
     * @param {string} data
     * @returns {{ fragment: ErrorFragment, name: string, signature: string, selector: string, args: Result }}
     */
    parseError(data: string): {
        fragment: ErrorFragment;
        name: string;
        signature: string;
        selector: string;
        args: Result;
    };
    /**
     * Return the 4-byte function selector (sighash) for a function fragment or
     * name. Mirrors ethers.js v5 getSighash / v6 FunctionFragment.selector.
     * @param {FunctionFragment|string} fragmentOrName
     * @returns {string}
     */
    getSighash(fragmentOrName: FunctionFragment | string): string;
    /**
     * Compute the topic0 (event signature hash) for an event.
     * @param {string|EventFragment|any} nameOrFragment
     * @returns {string} normalized 0x-prefixed topic hash
     */
    getEventTopic(nameOrFragment: string | EventFragment | any): string;
    getFallback(): null;
    getReceive(): null;
}
export class AbiCoder {
    /**
     * Return the shared default AbiCoder instance (ethers.js v6 shape).
     * @returns {AbiCoder}
     */
    static defaultAbiCoder(): AbiCoder;
    /**
     * Encode values by types into ABI data.
     * @param {(string|any)[]} types
     * @param {any[]} values
     * @returns {string}
     */
    encode(types: (string | any)[], values: any[]): string;
    /**
     * Decode ABI data by output types.
     * @param {(string|any)[]} types
     * @param {string} data
     * @returns {any}
     */
    decode(types: (string | any)[], data: string): any;
    /**
     * Return a default value for types.
     * @param {(string|any)[]} types
     * @returns {any}
     */
    getDefaultValue(types: (string | any)[]): any;
}
import { FunctionFragment } from "./fragments";
import { EventFragment } from "./fragments";
import { ErrorFragment } from "./fragments";
import { ConstructorFragment } from "./fragments";
import { Result } from "../utils/result";
