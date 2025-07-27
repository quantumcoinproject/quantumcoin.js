import { assert } from "../utils/index.js";
import { FallbackProvider } from "./provider-fallback.js";
import { JsonRpcProvider } from "./provider-jsonrpc.js";
import { Network } from "./network.js";
import { WebSocketProvider } from "./provider-websocket.js";
function isWebSocketLike(value) {
    return (value && typeof (value.send) === "function" &&
        typeof (value.close) === "function");
}
const Testnets = "goerli kovan sepolia classicKotti optimism-goerli arbitrum-goerli matic-mumbai bnbt".split(" ");
/**
 *  Returns a default provider for %%network%%.
 *
 *  If %%network%% is a [[WebSocketLike]] or string that begins with
 *  ``"ws:"`` or ``"wss:"``, a [[WebSocketProvider]] is returned backed
 *  by that WebSocket or URL.
 *
 *  If %%network%% is a string that begins with ``"HTTP:"`` or ``"HTTPS:"``,
 *  a [[JsonRpcProvider]] is returned connected to that URL.
 *
 *  Otherwise, a default provider is created backed by well-known public
 *  Web3 backends (such as [[link-infura]]) using community-provided API
 *  keys.
 *
 *  The %%options%% allows specifying custom API keys per backend (setting
 *  an API key to ``"-"`` will omit that provider) and ``options.exclusive``
 *  can be set to either a backend name or and array of backend names, which
 *  will whitelist **only** those backends.
 *
 *  Current backend strings supported are:
 *
 *  @example:
 *    // Connect to a local Geth node
 *    provider = getDefaultProvider("http://localhost:8545/");
 *
 *    // Connect to Ethereum mainnet with any current and future
 *    // third-party services available
 *    provider = getDefaultProvider("mainnet");
 *
 *    // Connect to Polygon, but only allow Etherscan and
 *    // INFURA and use "MY_API_KEY" in calls to Etherscan.
 *    provider = getDefaultProvider("matic", {
 *      etherscan: "MY_API_KEY",
 *      exclusive: [ "etherscan", "infura" ]
 *    });
 */
export function getDefaultProvider(network, options) {
    if (options == null) {
        options = {};
    }
    if (typeof (network) === "string" && network.match(/^https?:/)) {
        return new JsonRpcProvider(network);
    }
    if (typeof (network) === "string" && network.match(/^wss?:/) || isWebSocketLike(network)) {
        return new WebSocketProvider(network);
    }
    // Get the network and name, if possible
    let staticNetwork = null;
    try {
        staticNetwork = Network.from(network);
    }
    catch (error) { }
    const providers = [];
    assert(providers.length, "unsupported default network", "UNSUPPORTED_OPERATION", {
        operation: "getDefaultProvider"
    });
    // No need for a FallbackProvider
    if (providers.length === 1) {
        return providers[0];
    }
    // We use the floor because public third-party providers can be unreliable,
    // so a low number of providers with a large quorum will fail too often
    let quorum = Math.floor(providers.length / 2);
    if (quorum > 2) {
        quorum = 2;
    }
    // Testnets don't need as strong a security gaurantee and speed is
    // more useful during testing
    if (staticNetwork && Testnets.indexOf(staticNetwork.name) !== -1) {
        quorum = 1;
    }
    // Provided override qorum takes priority
    if (options && options.quorum) {
        quorum = options.quorum;
    }
    return new FallbackProvider(providers, undefined, { quorum });
}
//# sourceMappingURL=default-provider.js.map