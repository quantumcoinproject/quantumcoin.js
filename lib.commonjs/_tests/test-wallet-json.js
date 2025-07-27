"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const utils_js_1 = require("./utils.js");
const index_js_1 = require("../index.js");
describe("Tests JSON Wallet Formats", function () {
    const tests = (0, utils_js_1.loadTests)("wallets");
    tests.forEach((test) => {
        if (test.type !== "keystore") {
            return;
        }
        it(`tests decrypting Keystore JSON (sync): ${test.name}`, function () {
            this.timeout(20000);
            const password = (0, index_js_1.getBytes)(test.password);
            const account = (0, index_js_1.decryptKeystoreJsonSync)(test.content, password);
            //console.log(account);
            assert_1.default.equal(account.address, test.address, "address");
        });
    });
    tests.forEach((test) => {
        it(`tests decrypting JSON (sync): ${test.name}`, function () {
            this.timeout(20000);
            const password = (0, index_js_1.getBytes)(test.password);
            const wallet = index_js_1.Wallet.fromEncryptedJsonSync(test.content, password);
            //console.log(wallet);
            assert_1.default.equal(wallet.address, test.address, "address");
        });
    });
    tests.forEach((test) => {
        it(`tests decrypting JSON (async): ${test.name}`, async function () {
            this.timeout(20000);
            const password = (0, index_js_1.getBytes)(test.password);
            const wallet = await index_js_1.Wallet.fromEncryptedJson(test.content, password);
            //console.log(wallet);
            assert_1.default.equal(wallet.address, test.address, "address");
        });
    });
});
describe("Tests Extra JSON Wallet Functions", function () {
    const badKeystoreOptions = [
        {
            name: "invalid salt type",
            options: { salt: 42 },
            error: "invalid BytesLike value"
        },
        {
            name: "invalid uuid type",
            options: { uuid: 42 },
            error: "invalid BytesLike value"
        },
        {
            name: "invalid uuid length",
            options: { uuid: "0x1234" },
            error: "invalid options.uuid"
        },
        {
            name: "invalid iv type",
            options: { iv: 42 },
            error: "invalid BytesLike value"
        },
        {
            name: "invalid iv length",
            options: { iv: "0x1234" },
            error: "invalid options.iv"
        },
        {
            name: "invalid scrypt N (non-one-hot-encoded)",
            options: { scrypt: { N: 1023 } },
            error: "invalid scrypt N parameter"
        },
        {
            name: "invalid scrypt N (non-integer)",
            options: { scrypt: { N: 1.5 } },
            error: "invalid scrypt N parameter"
        },
        {
            name: "invalid scrypt r",
            options: { scrypt: { r: 1.5 } },
            error: "invalid scrypt r parameter"
        },
        {
            name: "invalid scrypt p",
            options: { scrypt: { p: 1.5 } },
            error: "invalid scrypt p parameter"
        },
    ];
    const wallet = index_js_1.Wallet.createRandom();
    const account = { address: wallet.address, privateKey: wallet.privateKey };
    const password = "foobar";
    for (const { name, error } of badKeystoreOptions) {
        it(`tests bad keystore options: ${name}`, function () {
            assert_1.default.throws(() => {
                const result = (0, index_js_1.encryptKeystoreJsonSync)(account, password);
                console.log(result);
            }, (e) => {
                return ((0, index_js_1.isError)(e, "INVALID_ARGUMENT") &&
                    e.message.startsWith(error));
            });
        });
    }
    // Mainly to round out weird edge cases in coverage
    it("tests encryption with options (sync)", function () {
        assert_1.default.ok((0, index_js_1.encryptKeystoreJsonSync)(account, password));
    });
});
//# sourceMappingURL=test-wallet-json.js.map