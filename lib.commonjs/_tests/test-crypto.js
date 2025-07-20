"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const utils_js_1 = require("./utils.js");
const index_js_1 = require("../index.js");
const index_js_2 = require("../index.js");
describe("test hashing", function () {
    const tests = (0, utils_js_1.loadTests)("hashes");
    tests.forEach((test) => {
        it(`computes sha2-256: ${test.name}`, function () {
            assert_1.default.equal((0, index_js_2.sha256)(test.data), test.sha256);
        });
    });
    tests.forEach((test) => {
        it(`computes sha2-512: ${test.name}`, function () {
            assert_1.default.equal((0, index_js_2.sha512)(test.data), test.sha512);
        });
    });
    tests.forEach((test) => {
        it(`computes ripemd160: ${test.name}`, function () {
            assert_1.default.equal((0, index_js_2.ripemd160)(test.data), test.ripemd160);
        });
    });
    tests.forEach((test) => {
        it(`computes keccak256: ${test.name}`, function () {
            assert_1.default.equal((0, index_js_2.keccak256)(test.data), test.keccak256);
        });
    });
});
describe("test password-based key derivation", function () {
    const tests = (0, utils_js_1.loadTests)("pbkdf");
    tests.forEach((test) => {
        it(`computes pbkdf2: ${test.name}`, function () {
            const password = (0, index_js_1.getBytes)(test.password);
            const salt = (0, index_js_1.getBytes)(test.salt);
            const { iterations, algorithm, key } = test.pbkdf2;
            const result = (0, index_js_2.pbkdf2)(password, salt, iterations, test.dkLen, algorithm);
            assert_1.default.equal(result, key);
        });
    });
    tests.forEach((test) => {
        it(`computes scrypt (sync): ${test.name}`, function () {
            this.timeout(1000);
            const password = (0, index_js_1.getBytes)(test.password);
            const salt = (0, index_js_1.getBytes)(test.salt);
            const { N, r, p, key } = test.scrypt;
            const result = (0, index_js_2.scryptSync)(password, salt, N, r, p, test.dkLen);
            assert_1.default.equal(result, key);
        });
    });
    tests.forEach((test) => {
        it(`computes scrypt (async): ${test.name}`, async function () {
            this.timeout(1000);
            const password = (0, index_js_1.getBytes)(test.password);
            const salt = (0, index_js_1.getBytes)(test.salt);
            const { N, r, p, key } = test.scrypt;
            let progressCount = 0, progressOk = true, lastProgress = -1;
            const result = await (0, index_js_2.scrypt)(password, salt, N, r, p, test.dkLen, (progress) => {
                if (progress < lastProgress) {
                    progressOk = false;
                }
                lastProgress = progress;
                progressCount++;
            });
            assert_1.default.ok(progressOk, "progress was not monotonically increasing");
            assert_1.default.ok(progressCount > 100, "progress callback was called at leat 100 times");
            assert_1.default.equal(result, key);
        });
    });
});
describe("test hmac", function () {
    const tests = (0, utils_js_1.loadTests)("hmac");
    tests.forEach((test) => {
        it(`computes hmac: ${test.name}`, async function () {
            const { algorithm, key, data } = test;
            assert_1.default.equal((0, index_js_2.computeHmac)(algorithm, key, data), test.hmac);
        });
    });
});
//# sourceMappingURL=test-crypto.js.map