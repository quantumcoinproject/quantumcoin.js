import { BigNumberish, BytesLike } from "../utils/index.js";
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
/**
 *  A Signature  @TODO
 *
 *
 *  @_docloc: api/crypto:Signing
 */
export declare class Signature {
    #private;
    /**
     *  The ``r`` value for a signature.
     *
     *  This represents the ``x`` coordinate of a "reference" or
     *  challenge point, from which the ``y`` can be computed.
     */
    get r(): string;
    set r(value: BytesLike);
    /**
     *  The ``s`` value for a signature.
     */
    get s(): string;
    set s(_value: BytesLike);
    /**
     *  The ``v`` value for a signature.
     */
    get v(): 1;
    set v(value: BigNumberish);
    /**
     *  The serialized representation.
     */
    get serialized(): string;
    /**
     *  @private
     */
    constructor(guard: any, r: string, s: string, v: 1);
    /**
     *  Returns a new identical [[Signature]].
     */
    clone(): Signature;
    /**
     *  Returns a representation that is compatible with ``JSON.stringify``.
     */
    toJSON(): any;
    /**
     *  Creates a new [[Signature]].
     *
     *  If no %%sig%% is provided, a new [[Signature]] is created
     *  with default values.
     *
     *  If %%sig%% is a string, it is parsed.
     */
    static from(sig?: SignatureLike): Signature;
}
//# sourceMappingURL=signature.d.ts.map