/**
 * @testCategory e2e
 * @blockchainRequired write
 * @transactional true
 *
 * Generates typed SDK packages (TS and JS) for AllSolidityTypes.sol,
 * then injects additional tests that call all methods and validate outputs.
 *
 * Local testing: run the QuantumCoin devnet (network ID 123123) and point QC_RPC_URL at it —
 * see https://github.com/quantumcoinproject/quantum-coin-go/blob/main/quantumcoin-devnet-readme.md
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { getRpcUrl, getChainId, logE2eConfig } = require("./helpers");
const { logSuite, logTest } = require("../verbose-logger");

function getNpmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(cmd, args, cwd, env) {
  const res = spawnSync(cmd, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
    windowsHide: true,
  });
  if (res.error) throw res.error;
  return res;
}

function _quoteIfNeeded(s) {
  if (typeof s !== "string") return s;
  return /[ \t"]/g.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

function runNpm(args, cwd, env) {
  if (process.platform === "win32") {
    const cmd = `${getNpmCmd()} ${args.map(_quoteIfNeeded).join(" ")}`;
    return run("cmd.exe", ["/d", "/s", "/c", cmd], cwd, env);
  }
  return run(getNpmCmd(), args, cwd, env);
}

function runNpx(args, cwd, env) {
  if (process.platform === "win32") {
    const cmd = `npx ${args.map(_quoteIfNeeded).join(" ")}`;
    return run("cmd.exe", ["/d", "/s", "/c", cmd], cwd, env);
  }
  return run("npx", args, cwd, env);
}

function writeExtraTest(pkgRoot) {
  const testDir = path.join(pkgRoot, "test", "e2e");
  fs.mkdirSync(testDir, { recursive: true });

  const content = `/**
 * @testCategory e2e
 * @blockchainRequired write
 * @transactional true
 * @description Extra exhaustive checks for AllSolidityTypes
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { Initialize } = require("quantumcoin/config");
const { getProvider, Wallet } = require("quantumcoin");

// Require the generated package root (works for both TS and JS packages)
const { AllSolidityTypes__factory } = require("../..");

// Hardcoded test wallet (test-only; never use for real funds)
const TEST_WALLET_ENCRYPTED_JSON =
  ${JSON.stringify(
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}",
  )};
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

function normalizeHex(s) {
  const t = String(s || "").trim();
  const x = t.startsWith("0x") ? t : "0x" + t;
  return "0x" + x.slice(2).toLowerCase();
}

function canon(v) {
  if (v == null) return v;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (/^0x[0-9a-fA-F]*$/.test(v)) return normalizeHex(v);
    if (/^-?\\d+$/.test(v.trim())) return v.trim();
    return v;
  }
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === "object") {
    const keys = Object.keys(v);
    const hasNonNumeric = keys.some((k) => !/^\\d+$/.test(k));
    const picked = hasNonNumeric ? keys.filter((k) => !/^\\d+$/.test(k)) : keys;
    picked.sort();
    const out = {};
    for (const k of picked) out[k] = canon(v[k]);
    return out;
  }
  return v;
}

function hexOf(byteHex, lenBytes) {
  const b = byteHex.replace(/^0x/i, "");
  return normalizeHex("0x" + b.repeat(lenBytes));
}

function buildAllUints(seed) {
  const s = seed || 1;
  const num = (n) => Number(n);
  return {
    u8: num(8 + s), u16: num(16 + s), u24: num(24 + s), u32: num(32 + s), u40: num(40 + s), u48: num(48 + s), u56: num(56 + s), u64: num(64 + s),
    u72: num(72 + s), u80: num(80 + s), u88: num(88 + s), u96: num(96 + s), u104: num(104 + s), u112: num(112 + s), u120: num(120 + s), u128: num(128 + s),
    u136: num(136 + s), u144: num(144 + s), u152: num(152 + s), u160: num(160 + s), u168: num(168 + s), u176: num(176 + s), u184: num(184 + s), u192: num(192 + s),
    u200: num(200 + s), u208: num(208 + s), u216: num(216 + s), u224: num(224 + s), u232: num(232 + s), u240: num(240 + s), u248: num(248 + s), u256: num(256 + s),
  };
}

function buildAllInts(seed) {
  const s = seed || 1;
  const num = (n) => Number(n);
  return {
    i8: num(-8 - s), i16: num(-16 - s), i24: num(-24 - s), i32: num(-32 - s), i40: num(-40 - s), i48: num(-48 - s), i56: num(-56 - s), i64: num(-64 - s),
    i72: num(-72 - s), i80: num(-80 - s), i88: num(-88 - s), i96: num(-96 - s), i104: num(-104 - s), i112: num(-112 - s), i120: num(-120 - s), i128: num(-128 - s),
    i136: num(-136 - s), i144: num(-144 - s), i152: num(-152 - s), i160: num(-160 - s), i168: num(-168 - s), i176: num(-176 - s), i184: num(-184 - s), i192: num(-192 - s),
    i200: num(-200 - s), i208: num(-208 - s), i216: num(-216 - s), i224: num(-224 - s), i232: num(-232 - s), i240: num(-240 - s), i248: num(-248 - s), i256: num(-256 - s),
  };
}

function buildAllFixedBytes(seedByte) {
  const b = seedByte || "11";
  const o = {};
  for (let i = 1; i <= 32; i++) o["b" + i] = hexOf(b, i);
  return o;
}

function buildAllMisc(addr) {
  return {
    bo: true,
    addr,
    payableAddr: addr,
    str: "hello",
    dynBytes: normalizeHex("0x1234"),
    choice: 1,
    u256s: [1, 2, 3],
    i256s: [-1, -2],
    b32s: [hexOf("aa", 32), hexOf("bb", 32)],
    addrs: [addr],
    bools: [true, false, true],
    strings: ["a", "b"],
    bytesArr: [normalizeHex("0x00"), normalizeHex("0x12")],
    fixedU16: [1, 2, 3],
    fixedB32: [hexOf("cc", 32), hexOf("dd", 32)],
  };
}

function buildInner(addr, seed) {
  const u = buildAllUints(seed);
  const i = buildAllInts(seed);
  const fb = buildAllFixedBytes(seed % 2 ? "11" : "22");
  const misc = buildAllMisc(addr);
  const u2 = buildAllUints((seed || 1) + 10);
  const fb2 = buildAllFixedBytes(seed % 2 ? "33" : "44");
  return { u, i, fb, misc, uStructs: [u2], fixedFb: [fb, fb2], matrix: [[1,2],[3]] };
}

function buildOuter(addr) {
  const inner1 = buildInner(addr, 1);
  const inner2 = buildInner(addr, 2);
  return { inner: inner1, inners: [inner2], fixedInners: [inner1, inner2], b32Matrix: [[hexOf("01",32)],[hexOf("02",32),hexOf("03",32)]] };
}

describe("AllSolidityTypes (extra)", () => {
  it("roundtrips all methods", async (t) => {
    logSuite("AllSolidityTypes (extra)");
    logTest("roundtrips all methods", {});
    const rpcUrl = getRpcUrl();
    if (!rpcUrl) { t.skip("QC_RPC_URL/QC_ENDPOINT not provided"); return; }
    const chainId = getChainId();
    await Initialize(null);

    const provider = getProvider(rpcUrl, chainId);
    const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);

    const expectedU = buildAllUints(1);
    const expectedI = buildAllInts(1);
    const expectedFb = buildAllFixedBytes("11");

    const ctorSeedU256s = [1,2,3];
    const ctorSeedB32 = [expectedFb.b32, buildAllFixedBytes("22").b32];
    const miscParam = buildAllMisc(wallet.address);

    const factory = new AllSolidityTypes__factory(wallet);
    const contract = await factory.deploy(
      true,
      wallet.address,
      "hello",
      "0x1234",
      1,
      expectedU,
      expectedI,
      expectedFb,
      miscParam,
      ctorSeedU256s,
      ctorSeedB32,
      { gasLimit: 6_000_000 },
    );

    const tx = contract.deployTransaction();
    if (tx) await tx.wait(1, 600_000);

    assert.deepEqual(canon(await contract.echoAllUints(expectedU)), canon(expectedU));
    assert.deepEqual(canon(await contract.echoAllInts(expectedI)), canon(expectedI));
    assert.deepEqual(canon(await contract.echoAllFixedBytes(expectedFb)), canon(expectedFb));
    assert.deepEqual(canon(await contract.echoAllMisc(miscParam)), canon(miscParam));

    const inner = buildInner(wallet.address, 1);
    assert.deepEqual(canon(await contract.echoInner(inner)), canon(inner));

    const outer = buildOuter(wallet.address);
    assert.deepEqual(canon(await contract.echoOuter(outer)), canon(outer));

    const uArr = [buildAllUints(3), buildAllUints(4)];
    assert.deepEqual(canon(await contract.echoAllUintsArray(uArr)), canon(uArr));

    const innerArr = [buildInner(wallet.address, 3), buildInner(wallet.address, 4)];
    assert.deepEqual(canon(await contract.echoInnerArray(innerArr)), canon(innerArr));

    const matrix = [[1,2],[3,4,5]];
    assert.deepEqual(canon(await contract.echoMatrix(matrix)), canon(matrix));

    const multi = await contract.multiReturn(true, wallet.address, expectedFb.b32, "hello", 999, expectedU);
    const multiC = canon(multi);
    if (Array.isArray(multiC)) {
      assert.equal(multiC[0] === true || multiC[0] === "true", true);
      assert.equal(multiC[1], wallet.address);
      assert.equal(multiC[2], wallet.address);
      assert.equal(multiC[3], canon(expectedFb.b32));
      assert.equal(multiC[4], "hello");
      assert.equal(multiC[5], "999");
      assert.deepEqual(multiC[6], canon(expectedU));
    } else {
      assert.equal(multiC.outBo === true || multiC.outBo === "true", true);
      assert.equal(multiC.outAddr, wallet.address);
      assert.equal(multiC.outPayableAddr, wallet.address);
      assert.equal(multiC.outB32, canon(expectedFb.b32));
      assert.equal(multiC.outS, "hello");
      assert.equal(multiC.outX, "999");
      assert.deepEqual(multiC.outU, canon(expectedU));
    }
  }, { timeout: 1_800_000 });
});
`;

  fs.writeFileSync(path.join(testDir, "AllSolidityTypes.extra.test.js"), content, "utf8");
}

function assertNoLegacyGenericTypes(pkgRoot, contractName, lang) {
  const srcDir = path.join(pkgRoot, "src");
  const files =
    lang === "ts"
      ? [path.join(srcDir, `${contractName}.ts`)]
      : [path.join(srcDir, `${contractName}.js`), path.join(srcDir, `${contractName}.d.ts`)];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(/SolidityInputValue\s*</.test(text), false, `${path.basename(file)} still contains SolidityInputValue<>`);
    assert.equal(/SolidityOutputValue\s*</.test(text), false, `${path.basename(file)} still contains SolidityOutputValue<>`);
    assert.equal(/Promise<any>/.test(text), false, `${path.basename(file)} still contains Promise<any>`);
  }
}

// Runs a read-only `npm audit` on the generated SDK and fails the test only when
// actual vulnerabilities are reported. We never auto-fix/auto-approve anything:
// npm's non-zero exit code and unrelated warnings (install-scripts, funding, notices)
// are ignored; the pass/fail decision comes solely from the parsed JSON report.
function assertNpmAuditClean(pkgRoot, label, env) {
  if (!fs.existsSync(path.join(pkgRoot, "node_modules"))) {
    const install = runNpm(["install", "--no-fund", "--no-audit"], pkgRoot, env);
    assert.equal(install.status, 0, `${label}: npm install (for audit) failed:\n${install.stdout}\n${install.stderr}`);
  }
  const res = runNpm(["audit", "--json"], pkgRoot, env);
  let report;
  try {
    report = JSON.parse(res.stdout);
  } catch (err) {
    assert.fail(`${label}: could not parse 'npm audit --json' output:\n${res.stdout}\n${res.stderr}`);
  }
  const vulns = (report && report.metadata && report.metadata.vulnerabilities) || {};
  const total =
    typeof vulns.total === "number"
      ? vulns.total
      : ["info", "low", "moderate", "high", "critical"].reduce((sum, k) => sum + (Number(vulns[k]) || 0), 0);
  assert.equal(total, 0, `${label}: npm audit reported ${total} vulnerability(ies):\n${JSON.stringify(report.vulnerabilities || {}, null, 2)}`);
}

describe("AllSolidityTypes generated SDKs (extra tests)", () => {
  it("generates TS and JS packages and runs extra tests", async (t) => {
    logSuite("AllSolidityTypes generated SDKs (extra tests)");
    logTest("generates TS and JS packages and runs extra tests", {});
    const rpcUrl = getRpcUrl();
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }
    logE2eConfig();
    const chainId = getChainId();
    const repoRoot = path.resolve(__dirname, "..", "..");
    const solPath = path.join(repoRoot, "examples", "AllSolidityTypes.sol");
    assert.ok(fs.existsSync(solPath), "missing examples/AllSolidityTypes.sol");

    // Store generated SDK packages under test/e2e so they're easy to inspect.
    // NOTE: This folder is .gitignored (see root .gitignore).
    const outBase = path.join(repoRoot, "test", "e2e", "generated-sdks", "all-solidity-types");
    fs.mkdirSync(outBase, { recursive: true });

    const mkPkg = (lang) => {
      const pkgName = `all-solidity-types-${lang}`;
      const pkgRoot = path.join(outBase, pkgName);
      // Ensure deterministic output by clearing any previous run.
      fs.rmSync(pkgRoot, { recursive: true, force: true });
      const genCli = path.join(repoRoot, "generate-sdk.js");
      const res = run(
        process.execPath,
        [
          genCli,
          "--lang",
          lang,
          "--sol",
          solPath,
          "--name",
          "AllSolidityTypes",
          "--create-package",
          "--package-dir",
          outBase,
          "--package-name",
          pkgName,
          "--package-description",
          `${lang.toUpperCase()} typed package generated from AllSolidityTypes.sol (e2e)`,
          "--package-author",
          "quantumcoin.js test",
          "--package-license",
          "MIT",
          "--package-version",
          "0.0.1",
          "--non-interactive",
        ],
        repoRoot,
        process.env,
      );
      assert.equal(res.status, 0, `generator failed:\n${res.stdout}\n${res.stderr}`);
      return pkgRoot;
    };

    let succeeded = false;
    try {
      const tsPkg = mkPkg("ts");
      const jsPkg = mkPkg("js");

      // Inject extra tests
      writeExtraTest(tsPkg);
      writeExtraTest(jsPkg);

      // Verify we generated concrete (non-generic) Solidity types
      assertNoLegacyGenericTypes(tsPkg, "AllSolidityTypes", "ts");
      assertNoLegacyGenericTypes(jsPkg, "AllSolidityTypes", "js");

      assertNpmAuditClean(tsPkg, "TS package", process.env);
      assertNpmAuditClean(jsPkg, "JS package", process.env);

      const env = { ...process.env, QC_RPC_URL: rpcUrl, QC_CHAIN_ID: String(chainId) };

      const tsRun = runNpm(["test"], tsPkg, env);
      assert.equal(tsRun.status, 0, `TS package tests failed:\n${tsRun.stdout}\n${tsRun.stderr}`);

      const jsRun = runNpm(["test"], jsPkg, env);
      assert.equal(jsRun.status, 0, `JS package tests failed:\n${jsRun.stdout}\n${jsRun.stderr}`);

      // Run the generated offline signing example (offline deploy via sendRawTransaction) - both JS and TS.
      const tsExampleJs = run(process.execPath, [path.join(tsPkg, "examples", "offline-signing.js")], tsPkg, env);
      assert.equal(tsExampleJs.status, 0, `TS package offline-signing.js failed:\n${tsExampleJs.stdout}\n${tsExampleJs.stderr}`);

      const tsExampleTs = runNpx(["tsx", path.join("examples", "offline-signing.ts")], tsPkg, env);
      assert.equal(tsExampleTs.status, 0, `TS package offline-signing.ts failed:\n${tsExampleTs.stdout}\n${tsExampleTs.stderr}`);

      const jsExampleJs = run(process.execPath, [path.join(jsPkg, "examples", "offline-signing.js")], jsPkg, env);
      assert.equal(jsExampleJs.status, 0, `JS package offline-signing.js failed:\n${jsExampleJs.stdout}\n${jsExampleJs.stderr}`);

      const jsExampleTs = runNpx(["tsx", path.join("examples", "offline-signing.ts")], jsPkg, env);
      assert.equal(jsExampleTs.status, 0, `JS package offline-signing.ts failed:\n${jsExampleTs.stdout}\n${jsExampleTs.stderr}`);

      succeeded = true;
    } finally {
      // We intentionally keep the generated SDK packages under test/e2e.
      // Cleanup heavy folders to keep the repo light while preserving sources.
      if (succeeded) {
        for (const lang of ["ts", "js"]) {
          const pkgRoot = path.join(outBase, `all-solidity-types-${lang}`);
          fs.rmSync(path.join(pkgRoot, "node_modules"), { recursive: true, force: true });
          fs.rmSync(path.join(pkgRoot, "dist"), { recursive: true, force: true });
        }
      }
    }
  }, { timeout: 3_600_000 });
});

