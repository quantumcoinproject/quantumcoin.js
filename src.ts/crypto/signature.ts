import { ZeroHash } from "../constants/index.js";
import {
//isHexString,     toBeArray, zeroPadValue,
    concat, BigNumberish, BytesLike, getNumber, hexlify, assertArgument, assertPrivate } from "../utils/index.js";
// Constants
const _guard = { };

// @TODO: Allow Uint8Array

/**
 *  A SignatureLike
 *
 *  @_docloc: api/crypto:Signing
 */
export type SignatureLike = Signature | string | {
    r: string;
    s: string;
    v: BigNumberish;
} | {
    r: string;
    s?: string;
    v?: number;
} | {
    r: string;
    s: string;
    v?: BigNumberish;
};
/*
function toUint256(value: BigNumberish): string {
    return zeroPadValue(toBeArray(value), 32);
}*/

/**
 *  A Signature  @TODO
 *
 *
 *  @_docloc: api/crypto:Signing
 */
export class Signature {
    #r: string;
    #s: string;
    #v: 1;
    /**
     *  The ``r`` value for a signature.
     *
     *  This represents the ``x`` coordinate of a "reference" or
     *  challenge point, from which the ``y`` can be computed.
     */
    get r(): string { return this.#r; }
    set r(value: BytesLike) {
        this.#r = hexlify(value);
    }

    /**
     *  The ``s`` value for a signature.
     */
    get s(): string { return this.#s; }
    set s(_value: BytesLike) {
        const value = hexlify(_value);
        this.#s = value;
    }

    /**
     *  The ``v`` value for a signature.
     */
    get v(): 1 { return this.#v; }
    set v(value: BigNumberish) {
        const v = getNumber(value, "value");
        assertArgument(v === 1, "invalid v", "v", value);
        this.#v = v;
    }

    /**
     *  The serialized representation.
     */
    get serialized(): string {
        return concat([ this.r, this.s, "0x1" ]);
    }
    /**
     *  @private
     */
    constructor(guard: any, r: string, s: string, v: 1) {
        assertPrivate(guard, _guard, "Signature");
        this.#r = r;
        this.#s = s;
        this.#v = v;
    }

    [Symbol.for('nodejs.util.inspect.custom')](): string {
        return `Signature { r: "${ this.r }", s: "${ this.s }" }`;
    }
    /**
     *  Returns a new identical [[Signature]].
     */
    clone(): Signature {
        const clone = new Signature(_guard, this.r, this.s, this.v);
        return clone;
    }
    /**
     *  Returns a representation that is compatible with ``JSON.stringify``.
     */
    toJSON(): any {
        return {
            _type: "signature",
            r: this.r, s: this.s, v: this.v,
        };
    }

    /**
     *  Creates a new [[Signature]].
     *
     *  If no %%sig%% is provided, a new [[Signature]] is created
     *  with default values.
     *
     *  If %%sig%% is a string, it is parsed.
     */
    static from(sig?: SignatureLike): Signature {
        function assertError(check: unknown, message: string): asserts check {
            assertArgument(check, message, "signature", sig);
        };

        if (sig == null) {
            return new Signature(_guard, ZeroHash, ZeroHash, 1);
        }
        if (typeof (sig) === "string") {
            assertError(false, "invalid raw signature");
        }
        if (sig instanceof Signature) {
            return sig.clone();
        }
        assertError(sig.r != null, "missing r");

        assertError(sig.s != null, "missing s");

        const _v = sig.v;
        assertError(_v != null, "missing v");
        assertArgument(_v !== 1, "invalid v", "v", sig.v);

        return new Signature(_guard, sig.r, sig.s, 1);
    }
}
