/**
 * The initialize function has to be called before attempting to invoke any other function. This function should be called only once.
 *
 * @async
 * @function initialize
 * @param {Config} clientConfig - A configuration represented by the Config class
 * @return {Promise<boolean>} Returns a promise of type boolean; true if the initialization succeeded, else false.
 */
export function initialize(clientConfig: Config): Promise<boolean>;
/**
 * The serializeWallet function serializes a Wallet object to a JSON string. You should encrypt the string before saving it to disk or a database.
 *
 * @function serializeWallet
 * @param {Wallet} wallet - A Wallet object representing the wallet to serialize.
 * @return {string} Returns the Wallet in JSON string format. If the wallet is invalid, null is returned.
 */
export function serializeWallet(wallet: Wallet): string;
/**
 * The deserializeWallet function creates a Wallet object from a JSON string.
 *
 * @function deserializeWallet
 * @param {string} walletJson - A Wallet object representing the wallet to deserialize.
 * @return {Wallet} Returns the Wallet corresponding to the walletJson. If the wallet is invalid, null is returned.
 */
export function deserializeWallet(walletJson: string): Wallet;
/**
 * The serializeEncryptedWallet function encrypts and serializes a Wallet object to a JSON string readable by the Desktop/Mobile/Web/CLI wallet applications. You can save this string to a file and open the file in one of these wallet applications. You may also open this string using the deserializeEncryptedWallet function. If you loose the passphrase, you will be unable to open the wallet. This function can take upto a minute or so to execute.
 *
 * @function serializeEncryptedWallet
 * @param {Wallet} wallet - A Wallet object representing the wallet to serialize.
 * @param {string} passphrase - A passphrase used to encrypt the wallet. It should atleast be 12 characters long.
 * @return {string} Returns the Wallet in JSON string format. If the wallet is invalid, null is returned.
 */
export function serializeEncryptedWallet(wallet: Wallet, passphrase: string): string;
/**
 * The deserializeEncryptedWallet function opens a wallet backed-up using an application such as the Desktop/Mobile/CLI/Web wallet. This function can take upto a minute or so to execute. You should open wallets only from trusted sources.
 *
 * @function deserializeEncryptedWallet
 * @param {string} walletJsonString - The json string from a wallet file.
 * @param {string} passphrase - The passphrase used to encrypt the wallet.
 * @return {Wallet} Returns a Wallet object. Returns null if opening the wallet fails.
 */
export function deserializeEncryptedWallet(walletJsonString: string, passphrase: string): Wallet;
/**
 * The verifyWallet function verifies whether a Wallet is valid or not. To mitigate spoofing and other attachs, it is highly recommended to verify a wallet, especially if it is from an untrusted source.
 *
 * @function verifyWallet
 * @param {Wallet} wallet - A Wallet object representing the wallet to verify.
 * @return {boolean} Returns true if the Wallet verification succeeded, else returns false.
 */
export function verifyWallet(wallet: Wallet): boolean;
/**
 * The newWallet function creates a new Wallet.
 *
 * @function newWallet
 * @return {Wallet} Returns a Wallet object.
 */
export function newWallet(): Wallet;
/**
 * The sendCoins function posts a send-coin transaction to the blockchain.
 * Since the gas fee for sending coins is fixed at 1000 coins, there is no option to set the gas fee explicitly.
 * It may take many seconds after submitting a transaction before the transaction is returned by the getTransactionDetails function.
 * Transactions are usually committed in less than 30 seconds.
 *
 * @async
 * @function sendCoins
 * @param {Wallet} wallet - A Wallet object from which the transaction has to be sent. The address corresponding to the Wallet should have enough coins to cover gas fees as well. A minimum of 1000 coins (1000000000000000000000 wei) are required for gas fees.
 * @param {string} toAddress - The address to which the coins should be sent.
 * @param {string} coins - The string representing the number of coins (in ether) to send. To convert between ethers and wei, see https://docs.ethers.org/v4/api-utils.html#ether-strings-and-wei
 * @param {number} nonce - The nonce of the account retrieved by invoking the getAccountDetails function. You have to carefully manage state of the nonce to avoid sending the coins multiple times, such as when retrying sendCoins after a network error.
 * @return {Promise<SendResult>}  Returns a promise of type SendResult.
 */
export function sendCoins(wallet: Wallet, toAddress: string, coins: string, nonce: number): Promise<SendResult>;
/**
 * The getAccountDetails function returns details of an account corresponding to the address.
 *
 * @async
 * @function getAccountDetails
 * @param {string} address - The address of the account of which the details have to be retrieved.
 * @return {Promise<AccountDetailsResult>}  Returns a promise of type AccountDetailsResult.
 */
export function getAccountDetails(address: string): Promise<AccountDetailsResult>;
/**
 * The getTransactionDetails function returns details of a transaction posted to the blockchain.
 * Transactions may take a while to get registered in the blockchain. After a transaction is submitted, it may take a while before it is available for reading.
 * Some transactions that have lower balance than the minimum required for gas fees may be discarded.
 * In these cases, the transactions may not be returned when invoking the getTransactionDetails function.
 * You should consider the transaction as succeeded only if the status field of the transactionReceipt object is 0x1 (success).
 * The transactionReceipt field can be null unless the transaction is registered with the blockchain.
 * @async
 * @function getTransactionDetails
 * @param {string} txnHash - The hash of the transaction to retrieve.
 * @return {Promise<TransactionDetailsResult>}  Returns a promise of type type TransactionDetailsResult.
 */
export function getTransactionDetails(txnHash: string): Promise<TransactionDetailsResult>;
/**
 * The isAddressValid function validates whether an address is valid or not. An address is of length 66 characters including 0x.
 *
 * @function isAddressValid
 * @param {string} address - A string representing the address to validate.
 * @return {boolean} Returns true if the address validation succeeded, else returns false.
 */
export function isAddressValid(address: string): boolean;
/**
 * The getLatestBlockDetails function returns details of the latest block of the blockchain.
 *
 * @async
 * @function getLatestBlockDetails
 * @return {Promise<LatestBlockDetailsResult>}  Returns a promise of an object of type BlockDetailsResult.
 */
export function getLatestBlockDetails(): Promise<LatestBlockDetailsResult>;
/**
 * The signSendCoinTransaction function returns a signed transaction.
 * Since the gas fee for sending coins is fixed at 1000 coins, there is no option to set the gas fee explicitly.
 * This function is useful for offline (cold storage) wallets, where you can sign a transaction offline and then use the postTransaction function to post it on a connected device.
 * Another usecase for this function is when you want to first store a signed transaction to a database, then queue it and finally submit the transaction by calling the postTransaction function.
 *
 * @function signSendCoinTransaction
 * @param {Wallet} wallet - A Wallet object from which the transaction has to be sent. The address corresponding to the Wallet should have enough coins to cover gas fees as well. A minimum of 1000 coins (1000000000000000000000 wei) are required for gas fees.
 * @param {string} toAddress - The address to which the coins should be sent.
 * @param {string} coins - The string representing the number of coins (in ether) to send. To convert between ethers and wei, see https://docs.ethers.org/v4/api-utils.html#ether-strings-and-wei
 * @param {number} nonce - The nonce of the account retrieved by invoking the getAccountDetails function. You have to carefully manage state of the nonce to avoid sending the coins multiple times, such as when retrying sendCoins after a network error.
 * @return {SignResult}  Returns a promise of type SignResult.
 */
export function signSendCoinTransaction(wallet: Wallet, toAddress: string, coins: string, nonce: number): SignResult;
/**
 * The listAccountTransactions function returns a list of transactions for a specific account.
 * Transactions may take a while to get registered in the blockchain. After a transaction is submitted, it may take a while before it is available for listing.
 * Some transactions that have lower balance than the minimum required for gas fees may be discarded.
 * In these cases, the transactions may not be returned when invoking the listAccountTransactions function.
 * You should consider the transaction as succeeded only if the status field AccountDetailsCompact object is 0x1 (success).
 * Both transactions from and transactions to the address will be returned in the list.
 * Use the getTransactionDetails function, passing the hash of the transaction to get detailed information about the transaction.
 * @async
 * @function listAccountTransactions
 * @param {string} address - The address for which the transactions have to be listed.
 * @param {number} pageNumber - The page number for which the transactions has to be listed for the account. Pass 0 to list the latest page. Pass 1 to list the oldest page. A maximum of 20 transactions are returned in each page. The response of this API includes a field that shows the pageCount (total number of pages available). You can pass any number between 1 to pageCount to get the corresponding page.
 * @return {Promise<ListAccountTransactionsResponse>}  Returns a promise of type type ListAccountTransactionsResponse.
 */
export function listAccountTransactions(address: string, pageNumber: number): Promise<ListAccountTransactionsResponse>;
/**
 * The postTransaction function posts a signed transaction to the blockchain.
 * This method can be used in conjunction with the signSendCoinTransaction method to submit a transaction that was signed using a cold wallet (offline or disconnected or air-gapped wallet).
 *
 * @async
 * @function postTransaction
 * @param {string} txnData - A signed transaction string returned by the signSendCoinTransaction function.
 * @return {Promise<SendResult>}  Returns a promise of type SendResult. txnHash will be null in SendResult.
 */
export function postTransaction(txnData: string): Promise<SendResult>;
/**
 * @class
 * @constructor
 * @public
 * @classdesc This is the configuration class required to initialize and interact with Quantum Coin blockchain
 */
export class Config {
    /**
     * Creates a config class
     * @param {string} readUrl - The Read API URL pointing to a read relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay. The following URLs are community maintained. Please use your own relay service. Mainnet: https://sdk.readrelay.quantumcoinapi.com
     * @param {string} writeUrl - The Write API URL pointing to a write relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay. The following URLs are community maintained. Please use your own relay service. Mainnet: https://sdk.writerelay.quantumcoinapi.com
     * @param {number} chainId - The chain id of the blockchain. Mainnet chainId is 123123. Testnet T4 chainId is 310324.
     * @param {string} readApiKey - Optional parameter if authorization is enabled for the relay service. API Key for authorization. Defaults to null which indicates no authorization.
     * @param {string} writeApiKey - Optional parameter if authorization is enabled for the relay service. API Key for authorization. Defaults to null which indicates no authorization.
     */
    constructor(readUrl: string, writeUrl: string, chainId: number, readApiKey: string, writeApiKey: string);
    /**
     * The Read API URL pointing to a read relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay
     * @type {string}
     * @public
    */
    public readUrl: string;
    /**
     * The Read API URL pointing to a read relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay
     * @type {string}
     * @public
    */
    public writeUrl: string;
    /**
     * The chain id of the blockchain. Mainnet chainId is 123123. Testnet T4 chainId is 310324.
     * @type {number}
     * @public
    */
    public chainId: number;
    /**
     * API Key for authorization if authorization is enabled for the relay service. Defaults to null which indicates no authorization.
     * @type {string}
     * @public
    */
    public readApiKey: string;
    /**
     * API Key for authorization if authorization is enabled for the relay service. Defaults to null which indicates no authorization.
     * @type {string}
     * @public
    */
    public writeApiKey: string;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a Wallet. Use the verifyWallet function to verify if a wallet is valid. Verifying the wallet is highly recommended, especially if it comes from an untrusted source. For more details on the underlying cryptography of the Wallet, see https://github.com/QuantumCoinProject/hybrid-pqc
 */
export class Wallet {
    /**
     * Creates a Wallet class. The constructor does not verify the wallet. To verify a wallet, call the verifyWallet function explicitly.
     * @param {string} address - Address of the wallet
     * @param {number[]} privateKey - Private Key byte array of the wallet
     * @param {number[]} publicKey - The chain id of the blockchain. Mainnet chainId is 123123. Testnet T4 chainId is 310324.
     */
    constructor(address: string, privateKey: number[], publicKey: number[]);
    /**
     * Address of the wallet. Is 66 bytes in length including 0x (if the wallet is valid).
     * @type {string}
     * @public
    */
    public address: string;
    /**
     * Private Key byte array of the wallet. Is 4064 bytes in length (if the wallet is valid).
     * @type {number[]}
     * @public
    */
    public privateKey: number[];
    /**
     * Public Key byte array of the wallet. Is 1408 bytes in length (if the wallet is valid).
     * @type {number[]}
     * @public
    */
    public publicKey: number[];
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a Block.
 */
export class BlockDetails {
    constructor(blockNumber: any);
    /**
     * Block Number of the block
     * @type {number}
     * @public
    */
    public blockNumber: number;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a result from invoking the getLatestBlock function.
 */
export class LatestBlockDetailsResult {
    constructor(resultCode: any, blockDetails: any, response: any, requestId: any, err: any);
    /**
     * Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.
     * @type {number}
     * @public
    */
    public resultCode: number;
    /**
     * An object of type BlockDetails representing the block. This value is null if the value of resultCode is not 0.
     * @type {BlockDetails}
     * @public
    */
    public blockDetails: BlockDetails;
    /**
     * An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.
     * @type {Object}
     * @public
    */
    public response: any;
    /**
     * An unique id to represent the request. This can be null if request failed before it could be sent.
     * @type {string}
     * @public
    */
    public requestId: string;
    /**
     * An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.
     * @type {Error}
     * @public
    */
    public err: Error;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents an Account.
 */
export class AccountDetails {
    constructor(address: any, balance: any, nonce: any, blockNumber: any);
    /**
     * Address of the wallet. Is 66 bytes in length including 0x.
     * @type {string}
     * @public
    */
    public address: string;
    /**
     * Balance of the account in wei. To convert this to ethers, see https://docs.ethers.org/v4/api-utils.html#ether-strings-and-wei
     * @type {string}
     * @public
    */
    public balance: string;
    /**
     * A monotonically increasing number representing the nonce of the account. After each transaction from the account that gets registered in the blockchain, the nonce increases by 1.
     * @type {number}
     * @public
    */
    public nonce: number;
    /**
     * The block number as of which the Account details was retrieved.
     * @type {number}
     * @public
    */
    public blockNumber: number;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a result from invoking the getAccountDetails function.
 */
export class AccountDetailsResult {
    constructor(resultCode: any, accountDetails: any, response: any, requestId: any, err: any);
    /**
     * Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.
     * @type {number}
     * @public
    */
    public resultCode: number;
    /**
     * An object of type AccountDetails representing the block. This value is null if the value of resultCode is not 0.
     * @type {AccountDetails}
     * @public
    */
    public accountDetails: AccountDetails;
    /**
     * An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.
     * @type {Object}
     * @public
    */
    public response: any;
    /**
     * An unique id to represent the request. This can be null if request failed before it could be sent.
     * @type {string}
     * @public
    */
    public requestId: string;
    /**
     * An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.
     * @type {Error}
     * @public
    */
    public err: Error;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a result from invoking the sendCoins function.
 */
export class SendResult {
    constructor(resultCode: any, txnHash: any, response: any, requestId: any, err: any);
    /**
     * Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.
     * @type {number}
     * @public
    */
    public resultCode: number;
    /**
     * Hash of the Transaction, to uniquely identify it. Is 66 bytes in length including 0x. This value is null if the value of resultCode is not 0.
     * @type {string}
     * @public
    */
    public txnHash: string;
    /**
     * An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.
     * @type {Object}
     * @public
    */
    public response: any;
    /**
     * An unique id to represent the request. This can be null if request failed before it could be sent.
     * @type {string}
     * @public
    */
    public requestId: string;
    /**
     * An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.
     * @type {Error}
     * @public
    */
    public err: Error;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a Receipt of a transaction that is registered in the blockchain. The transactionReceipt field can be null unless the transaction is registered with the blockchain.
 * While the transaction is pending, this field will be null. You should consider the transaction as succeeded only if the status field's value is 0x1 (success).
 */
export class TransactionReceipt {
    /**
     * A hexadecimal string representing the total amount of gas used when this transaction was executed in the block.
     * @type {string}
     * @public
    */
    public cumulativeGasUsed: string;
    /**
     * A hexadecimal string representing the sum of the base fee and tip paid per unit of gas.
     * @type {string}
     * @public
    */
    public effectiveGasPrice: string;
    /**
     * A hexadecimal string representing the amount of gas used by this specific transaction alone.
     * @type {string}
     * @public
    */
    public gasUsed: string;
    /**
     * A hexadecimal string representing either 0x1 (success) or 0x0 (failure). Failed transactions can also incur gas fee. You should consider the transaction as succeeded only if the status value is 0x1 (success).
     * @type {string}
     * @public
    */
    public status: string;
    /**
     * Hash of the Transaction, to uniquely identify it. Is 66 bytes in length including 0x.
     * @type {string}
     * @public
    */
    public hash: string;
    /**
     * A hexadecimal string representing the transaction type. 0x0 is DefaultFeeTxType.
     * @type {string}
     * @public
    */
    public type: string;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents details of a transaction. You should consider the transaction as succeeded only if the status field of the receipt object is 0x1 (success).
 */
export class TransactionDetails {
    /**
     * A hexadecimal string representing the hash of the block that registered the transaction. This field can be null if the transaction was not registered in the blockchain.
     * @type {string}
     * @public
    */
    public blockHash: string;
    /**
     * The number of the block that registered the transaction. This field can be null if the transaction was not registered in the blockchain.
     * @type {number}
     * @public
    */
    public blockNumber: number;
    /**
     * A 66 character hexadecimal string representing the address the transaction is sent from.
     * @type {string}
     * @public
    */
    public from: string;
    /**
     * A hexadecimal string representing the gas provided for the transaction execution.
     * @type {string}
     * @public
    */
    public gas: string;
    /**
     * A hexadecimal string representing the gasPrice used for each paid gas, in Wei.
     * @type {string}
     * @public
    */
    public gasPrice: string;
    /**
     * A 66 character hexadecimal string representing the hash of the transaction.
     * @type {string}
     * @public
    */
    public hash: string;
    /**
     * A hexadecimal string representing the compiled code of a contract OR the hash of the invoked method signature and encoded parameters.
     * @type {string}
     * @public
    */
    public input: string;
    /**
     * A monotonically increasing number representing the nonce of the account. After each transaction from the account that gets registered in the blockchain, the nonce increases by 1.
     * @type {number}
     * @public
    */
    public nonce: number;
    /**
     * A 66 character hexadecimal string representing address the transaction is directed to.
     * @type {string}
     * @public
    */
    public to: string;
    /**
     * A hexadecimal string representing the value sent with this transaction. The value can be 0 for smart contract transactions, since it only represents the number of coins sent.
     * @type {string}
     * @public
    */
    public value: string;
    /**
     * The receipt of the transaction. This field will be null while the transaction is pending (not yet registered in the blockchain).
     * @type {TransactionReceipt}
     * @public
    */
    public receipt: TransactionReceipt;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a result from invoking the getTransactionDetails function. If transactions get discarded by the blockchain, for reasons such as due to lower than minimum gas fees or invalid nonce, the resultCode will always contain a non-zero value (failure).
 */
export class TransactionDetailsResult {
    constructor(resultCode: any, transactionDetails: any, response: any, requestId: any, err: any);
    /**
     * Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.
     * @type {number}
     * @public
    */
    public resultCode: number;
    /**
     * An object of type TransactionDetails representing the transaction. This value is null if the value of resultCode is not 0.
     * @type {TransactionDetails}
     * @public
    */
    public transactionDetails: TransactionDetails;
    /**
     * An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.
     * @type {Object}
     * @public
    */
    public response: any;
    /**
     * An unique id to represent the request. This can be null if request failed before it could be sent.
     * @type {string}
     * @public
    */
    public requestId: string;
    /**
     * An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.
     * @type {Error}
     * @public
    */
    public err: Error;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a result from invoking the listAccountTransactionDetails function.
 */
export class AccountTransactionsResult {
    constructor(resultCode: any, listAccountTransactionsResponse: any, response: any, requestId: any, err: any);
    /**
     * Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.
     * @type {number}
     * @public
    */
    public resultCode: number;
    /**
     * An object of type ListAccountTransactionsResponse representing the list of transactions along with metadata. This value is null if the value of resultCode is not 0.
     * @type {ListAccountTransactionsResponse}
     * @public
    */
    public listAccountTransactionsResponse: ListAccountTransactionsResponse;
    /**
     * An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.
     * @type {Object}
     * @public
    */
    public response: any;
    /**
     * An unique id to represent the request. This can be null if request failed before it could be sent.
     * @type {string}
     * @public
    */
    public requestId: string;
    /**
     * An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.
     * @type {Error}
     * @public
    */
    public err: Error;
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a list of account transactions returned by the listAccountTransactionDetails function.
 */
export class ListAccountTransactionsResponse {
    /**
     * The number of pages available for listing.
     * @type {number}
     * @public
    */
    public pageCount: number;
    /**
     * An array of type AccountTransactionCompact, containing the list of transactions. Can be null if no items are available.
     * @type {(AccountTransactionCompact|Array)}
     * @public
    */
    public items: (AccountTransactionCompact | any[]);
}
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a transaction of an account. You should consider the transaction as succeeded only if the status field is 0x1 (success).
 */
export class AccountTransactionCompact {
    /**
     * The number of the block that registered the transaction. This field can be null if the transaction was not registered in the blockchain.
     * @type {number}
     * @public
    */
    public blockNumber: number;
    /**
     * A 66 character hexadecimal string representing the address the transaction is sent from.
     * @type {string}
     * @public
    */
    public from: string;
    /**
     * A 66 character hexadecimal string representing the hash of the transaction.
     * @type {string}
     * @public
    */
    public hash: string;
    /**
     * A 66 character hexadecimal string representing address the transaction is directed to.
     * @type {string}
     * @public
    */
    public to: string;
    /**
     * A hexadecimal string representing the value sent with this transaction. The value can be 0 for smart contract transactions, since it only represents the number of coins sent.
     * @type {string}
     * @public
    */
    public value: string;
    /**
     * A hexadecimal string representing either 0x1 (success) or 0x0 (failure). Failed transactions can also incur gas fee. You should consider the transaction as succeeded only if the status value is 0x1 (success).
     * @type {string}
     * @public
    */
    public status: string;
}
/**
 * The newWalletSeed function creates a new Wallet seed word list. The return array can then be passed to the openWalletFromSeedWords function to create a new wallet.
 *
 * @function newWalletSeed
 * @return {array} Returns an array of seed words (48 words in total). Returns null if the operation failed.
 */
export function newWalletSeed(): any[];
/**
 * The openWalletFromSeedWords function creates a wallet from a seed word list. The seed word list is available for wallets created from Desktop/Web/Mobile wallets.
 *
 * @function openWalletFromSeedWords
 * @param {array} seedWordList - An array of seed words. There should be 48 words in total.
 * @return {Wallet} Returns a Wallet object. Returns null if the operation failed.
 */
export function openWalletFromSeedWords(seedWordList: any[]): Wallet;
/**
 * The publicKeyFromSignature extracts the public key from a signature.
 *
 * @function publicKeyFromSignature
 * @param {number[]} digest - An array of bytes containing the digestHash. Should be of length 32.
 * @param {number[]} signature - An array of bytes containing the signature.
 * @return {string} - Returns the public key as a hex string. Returns null if the operation failed.
 */
export function publicKeyFromSignature(digest: number[], signature: number[]): string;
/**
 * The publicKeyFromPrivateKey extracts the public key from a private key.
 *
 * @function publicKeyFromPrivateKey
 * @param {number[]} privateKey - An array of bytes containing the privateKey.
 * @return {string} - Returns the public key as a hex string. Returns null if the operation failed.
 */
export function publicKeyFromPrivateKey(privateKey: number[]): string;
/**
 * The addressFromPublicKey returns the address corresponding to the public key.
 *
 * @function addressFromPublicKey
 * @param {number[]} publicKey - An array of bytes containing the public key.
 * @return {string} - Returns the address corresponding to the public key as a hex string. Returns null if the operation failed.
 */
export function addressFromPublicKey(publicKey: number[]): string;
/**
 * The combinePublicKeySignature combines the public key and signature.
 *
 * @function combinePublicKeySignature
 * @param {number[]} publicKey - An array of bytes containing the public key.
 * @param {number[]} signature - An array of bytes containing the signature.
 * @return {string} - Returns a hex string corresponding to combined signature. Returns null if the operation failed.
 */
export function combinePublicKeySignature(publicKey: number[], signature: number[]): string;
/**
 * @class
 * @constructor
 * @public
 * @classdesc This class represents a result from invoking the signSendCoinTransaction function.
 */
declare class SignResult {
    constructor(resultCode: any, txnHash: any, txnData: any);
    /**
     * Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.
     * @type {number}
     * @public
    */
    public resultCode: number;
    /**
     * Hash of the Transaction, to uniquely identify it. Is 66 bytes in length including 0x. This value is null if the value of resultCode is not 0.
     * @type {string}
     * @public
    */
    public txnHash: string;
    /**
     * A payload representing the signed transaction.
     * To actually send a transaction, this payload can then be taken to to a different device that is connected to the blockchain relay and then sent using the postTransaction function.
     * This value is null if the value of resultCode is not 0.
     * @type {string}
     * @public
    */
    public txnData: string;
}
export {};
