import { ZeroHash } from "../constants/index.js";
import { getNumber, hexlify, assertArgument, assertPrivate } from "../utils/index.js";
// Constants
const _guard = {};
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
    #r;
    #s;
    #v;
    /**
     *  The ``r`` value for a signature.
     *
     *  This represents the ``x`` coordinate of a "reference" or
     *  challenge point, from which the ``y`` can be computed.
     */
    get r() { return this.#r; }
    set r(value) {
        this.#r = hexlify(value);
    }
    /**
     *  The ``s`` value for a signature.
     */
    get s() { return this.#s; }
    set s(_value) {
        const value = hexlify(_value);
        this.#s = value;
    }
    /**
     *  The ``v`` value for a signature.
     */
    get v() { return this.#v; }
    set v(value) {
        const v = getNumber(value, "value");
        assertArgument(v === 1, "invalid v", "v", value);
        this.#v = v;
    }
    /**
     *  The serialized representation.
     */
    get serialized() {
        return JSON.stringify({
            r: this.r,
            s: this.s,
            v: this.v
        });
    }
    /**
     *  @private
     */
    constructor(guard, r, s, v) {
        assertPrivate(guard, _guard, "Signature");
        this.#r = r;
        this.#s = s;
        this.#v = v;
    }
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return `Signature { r: "${this.r}", s: "${this.s}" }`;
    }
    /**
     *  Returns a new identical [[Signature]].
     */
    clone() {
        const clone = new Signature(_guard, this.r, this.s, this.v);
        return clone;
    }
    /**
     *  Returns a representation that is compatible with ``JSON.stringify``.
     */
    toJSON() {
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
    static from(sig) {
        function assertError(check, message) {
            assertArgument(check, message, "signature", sig);
        }
        ;
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
        assertArgument(_v === 1, "invalid v", "v", sig.v);
        return new Signature(_guard, sig.r, sig.s, 1);
    }
}
//# sourceMappingURL=signature.js.map