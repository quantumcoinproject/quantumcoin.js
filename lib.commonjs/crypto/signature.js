"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Signature = void 0;
const index_js_1 = require("../constants/index.js");
const index_js_2 = require("../utils/index.js");
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
class Signature {
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
        this.#r = (0, index_js_2.hexlify)(value);
    }
    /**
     *  The ``s`` value for a signature.
     */
    get s() { return this.#s; }
    set s(_value) {
        const value = (0, index_js_2.hexlify)(_value);
        this.#s = value;
    }
    /**
     *  The ``v`` value for a signature.
     */
    get v() { return this.#v; }
    set v(value) {
        const v = (0, index_js_2.getNumber)(value, "value");
        (0, index_js_2.assertArgument)(v === 1, "invalid v", "v", value);
        this.#v = v;
    }
    /**
     *  The serialized representation.
     */
    get serialized() {
        return (0, index_js_2.concat)([this.r, this.s, "0x1"]);
    }
    /**
     *  @private
     */
    constructor(guard, r, s, v) {
        (0, index_js_2.assertPrivate)(guard, _guard, "Signature");
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
            (0, index_js_2.assertArgument)(check, message, "signature", sig);
        }
        ;
        if (sig == null) {
            return new Signature(_guard, index_js_1.ZeroHash, index_js_1.ZeroHash, 1);
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
        (0, index_js_2.assertArgument)(_v !== 1, "invalid v", "v", sig.v);
        return new Signature(_guard, sig.r, sig.s, 1);
    }
}
exports.Signature = Signature;
//# sourceMappingURL=signature.js.map