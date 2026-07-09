/**
 * @fileoverview Minimal ABI fragment classes (ethers.js v6 compatible surface).
 *
 * This SDK keeps fragment handling lightweight and delegates ABI encoding/decoding
 * to `quantum-coin-js-sdk` (WASM).
 */
export class Fragment {
    /**
     * @param {any} fragment
     */
    constructor(fragment: any);
    type: any;
    name: any;
    inputs: any;
    outputs: any;
    stateMutability: any;
    anonymous: any;
    /**
     * Formats the fragment.
     * @param {string=} format
     * @returns {string}
     */
    format(format?: string | undefined): string;
    /**
     * @returns {any}
     */
    toJSON(): any;
}
export class NamedFragment extends Fragment {
}
export class FunctionFragment extends NamedFragment {
    /**
     * The 4-byte function selector (sighash), e.g. "0xa9059cbb". Requires the SDK
     * to be initialized (uses keccak256). Mirrors ethers.js v6.
     * @returns {string}
     */
    get selector(): string;
}
export class EventFragment extends NamedFragment {
    /**
     * The event topic hash (topic0). Requires the SDK to be initialized (uses
     * keccak256). Mirrors ethers.js v6.
     * @returns {string}
     */
    get topicHash(): string;
}
export class ErrorFragment extends NamedFragment {
    /**
     * The 4-byte error selector. Requires the SDK to be initialized (uses
     * keccak256). Mirrors ethers.js v6.
     * @returns {string}
     */
    get selector(): string;
}
export class ConstructorFragment extends Fragment {
}
export class StructFragment extends Fragment {
}
export class FallbackFragment extends Fragment {
}
