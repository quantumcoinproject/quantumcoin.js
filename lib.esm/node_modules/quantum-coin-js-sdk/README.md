<a name="module_quantum-coin-js-sdk"></a>

## quantum-coin-js-sdk
Quantum Coin JS SDK provides functionality to interact with the Quantum Coin Blockchain using the Relay APIs.[Example Project](https://github.com/quantumcoinproject/quantum-coin-js-sdk/tree/main/example)

**Example**  
```js
Requires Node.js version v20.18.1 or higherInstallation:npm install quantum-coin-js-sdk --save//Adding reference:var qcsdk = require('quantum-coin-js-sdk');//Initialize the SDK first before invoking any other functionvar clientConfigVal = new qcsdk.Config("https://sdk.readrelay.quantumcoinapi.com", "https://sdk.writerelay.quantumcoinapi.com", 123123, "", ""); //TMainnet Block Explorer: https://QuantumScan.com qcsdk.initialize(clientConfigVal).then((initResult) => {  }Example Project: https://github.com/quantumcoinproject/quantum-coin-js-sdk/tree/main/example
```

* [quantum-coin-js-sdk](#module_quantum-coin-js-sdk)
    * [~Config](#module_quantum-coin-js-sdk..Config)
        * [new Config(readUrl, writeUrl, chainId, readApiKey, writeApiKey)](#new_module_quantum-coin-js-sdk..Config_new)
        * [.readUrl](#module_quantum-coin-js-sdk..Config+readUrl) : <code>string</code>
        * [.writeUrl](#module_quantum-coin-js-sdk..Config+writeUrl) : <code>string</code>
        * [.chainId](#module_quantum-coin-js-sdk..Config+chainId) : <code>number</code>
        * [.readApiKey](#module_quantum-coin-js-sdk..Config+readApiKey) : <code>string</code>
        * [.writeApiKey](#module_quantum-coin-js-sdk..Config+writeApiKey) : <code>string</code>
    * [~Wallet](#module_quantum-coin-js-sdk..Wallet)
        * [new Wallet(address, privateKey, publicKey)](#new_module_quantum-coin-js-sdk..Wallet_new)
        * [.address](#module_quantum-coin-js-sdk..Wallet+address) : <code>string</code>
        * [.privateKey](#module_quantum-coin-js-sdk..Wallet+privateKey) : <code>Array.&lt;number&gt;</code>
        * [.publicKey](#module_quantum-coin-js-sdk..Wallet+publicKey) : <code>Array.&lt;number&gt;</code>
    * [~BlockDetails](#module_quantum-coin-js-sdk..BlockDetails)
        * [.blockNumber](#module_quantum-coin-js-sdk..BlockDetails+blockNumber) : <code>number</code>
    * [~LatestBlockDetailsResult](#module_quantum-coin-js-sdk..LatestBlockDetailsResult)
        * [.resultCode](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+resultCode) : <code>number</code>
        * [.blockDetails](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+blockDetails) : <code>BlockDetails</code>
        * [.response](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+response) : <code>Object</code>
        * [.requestId](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+requestId) : <code>string</code>
        * [.err](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+err) : <code>Error</code>
    * [~AccountDetails](#module_quantum-coin-js-sdk..AccountDetails)
        * [.address](#module_quantum-coin-js-sdk..AccountDetails+address) : <code>string</code>
        * [.balance](#module_quantum-coin-js-sdk..AccountDetails+balance) : <code>string</code>
        * [.nonce](#module_quantum-coin-js-sdk..AccountDetails+nonce) : <code>number</code>
        * [.blockNumber](#module_quantum-coin-js-sdk..AccountDetails+blockNumber) : <code>number</code>
    * [~AccountDetailsResult](#module_quantum-coin-js-sdk..AccountDetailsResult)
        * [.resultCode](#module_quantum-coin-js-sdk..AccountDetailsResult+resultCode) : <code>number</code>
        * [.accountDetails](#module_quantum-coin-js-sdk..AccountDetailsResult+accountDetails) : <code>AccountDetails</code>
        * [.response](#module_quantum-coin-js-sdk..AccountDetailsResult+response) : <code>Object</code>
        * [.requestId](#module_quantum-coin-js-sdk..AccountDetailsResult+requestId) : <code>string</code>
        * [.err](#module_quantum-coin-js-sdk..AccountDetailsResult+err) : <code>Error</code>
    * [~SignResult](#module_quantum-coin-js-sdk..SignResult)
        * [.resultCode](#module_quantum-coin-js-sdk..SignResult+resultCode) : <code>number</code>
        * [.txnHash](#module_quantum-coin-js-sdk..SignResult+txnHash) : <code>string</code>
        * [.txnData](#module_quantum-coin-js-sdk..SignResult+txnData) : <code>string</code>
    * [~SendResult](#module_quantum-coin-js-sdk..SendResult)
        * [.resultCode](#module_quantum-coin-js-sdk..SendResult+resultCode) : <code>number</code>
        * [.txnHash](#module_quantum-coin-js-sdk..SendResult+txnHash) : <code>string</code>
        * [.response](#module_quantum-coin-js-sdk..SendResult+response) : <code>Object</code>
        * [.requestId](#module_quantum-coin-js-sdk..SendResult+requestId) : <code>string</code>
        * [.err](#module_quantum-coin-js-sdk..SendResult+err) : <code>Error</code>
    * [~TransactionReceipt](#module_quantum-coin-js-sdk..TransactionReceipt)
        * [.cumulativeGasUsed](#module_quantum-coin-js-sdk..TransactionReceipt+cumulativeGasUsed) : <code>string</code>
        * [.effectiveGasPrice](#module_quantum-coin-js-sdk..TransactionReceipt+effectiveGasPrice) : <code>string</code>
        * [.gasUsed](#module_quantum-coin-js-sdk..TransactionReceipt+gasUsed) : <code>string</code>
        * [.status](#module_quantum-coin-js-sdk..TransactionReceipt+status) : <code>string</code>
        * [.hash](#module_quantum-coin-js-sdk..TransactionReceipt+hash) : <code>string</code>
        * [.type](#module_quantum-coin-js-sdk..TransactionReceipt+type) : <code>string</code>
    * [~TransactionDetails](#module_quantum-coin-js-sdk..TransactionDetails)
        * [.blockHash](#module_quantum-coin-js-sdk..TransactionDetails+blockHash) : <code>string</code>
        * [.blockNumber](#module_quantum-coin-js-sdk..TransactionDetails+blockNumber) : <code>number</code>
        * [.from](#module_quantum-coin-js-sdk..TransactionDetails+from) : <code>string</code>
        * [.gas](#module_quantum-coin-js-sdk..TransactionDetails+gas) : <code>string</code>
        * [.gasPrice](#module_quantum-coin-js-sdk..TransactionDetails+gasPrice) : <code>string</code>
        * [.hash](#module_quantum-coin-js-sdk..TransactionDetails+hash) : <code>string</code>
        * [.input](#module_quantum-coin-js-sdk..TransactionDetails+input) : <code>string</code>
        * [.nonce](#module_quantum-coin-js-sdk..TransactionDetails+nonce) : <code>number</code>
        * [.to](#module_quantum-coin-js-sdk..TransactionDetails+to) : <code>string</code>
        * [.value](#module_quantum-coin-js-sdk..TransactionDetails+value) : <code>string</code>
        * [.receipt](#module_quantum-coin-js-sdk..TransactionDetails+receipt) : <code>TransactionReceipt</code>
    * [~TransactionDetailsResult](#module_quantum-coin-js-sdk..TransactionDetailsResult)
        * [.resultCode](#module_quantum-coin-js-sdk..TransactionDetailsResult+resultCode) : <code>number</code>
        * [.transactionDetails](#module_quantum-coin-js-sdk..TransactionDetailsResult+transactionDetails) : <code>TransactionDetails</code>
        * [.response](#module_quantum-coin-js-sdk..TransactionDetailsResult+response) : <code>Object</code>
        * [.requestId](#module_quantum-coin-js-sdk..TransactionDetailsResult+requestId) : <code>string</code>
        * [.err](#module_quantum-coin-js-sdk..TransactionDetailsResult+err) : <code>Error</code>
    * [~AccountTransactionCompact](#module_quantum-coin-js-sdk..AccountTransactionCompact)
        * [.blockNumber](#module_quantum-coin-js-sdk..AccountTransactionCompact+blockNumber) : <code>number</code>
        * [.from](#module_quantum-coin-js-sdk..AccountTransactionCompact+from) : <code>string</code>
        * [.hash](#module_quantum-coin-js-sdk..AccountTransactionCompact+hash) : <code>string</code>
        * [.to](#module_quantum-coin-js-sdk..AccountTransactionCompact+to) : <code>string</code>
        * [.value](#module_quantum-coin-js-sdk..AccountTransactionCompact+value) : <code>string</code>
        * [.status](#module_quantum-coin-js-sdk..AccountTransactionCompact+status) : <code>string</code>
    * [~ListAccountTransactionsResponse](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse)
        * [.pageCount](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse+pageCount) : <code>number</code>
        * [.items](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse+items) : <code>AccountTransactionCompact</code> \| <code>Array</code>
    * [~AccountTransactionsResult](#module_quantum-coin-js-sdk..AccountTransactionsResult)
        * [.resultCode](#module_quantum-coin-js-sdk..AccountTransactionsResult+resultCode) : <code>number</code>
        * [.listAccountTransactionsResponse](#module_quantum-coin-js-sdk..AccountTransactionsResult+listAccountTransactionsResponse) : <code>ListAccountTransactionsResponse</code>
        * [.response](#module_quantum-coin-js-sdk..AccountTransactionsResult+response) : <code>Object</code>
        * [.requestId](#module_quantum-coin-js-sdk..AccountTransactionsResult+requestId) : <code>string</code>
        * [.err](#module_quantum-coin-js-sdk..AccountTransactionsResult+err) : <code>Error</code>
    * [~initialize(clientConfig)](#module_quantum-coin-js-sdk..initialize) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [~isAddressValid(address)](#module_quantum-coin-js-sdk..isAddressValid) ⇒ <code>boolean</code>
    * [~newWallet()](#module_quantum-coin-js-sdk..newWallet) ⇒ <code>Wallet</code>
    * [~newWalletSeed()](#module_quantum-coin-js-sdk..newWalletSeed) ⇒ <code>array</code>
    * [~openWalletFromSeedWords(seedWordList)](#module_quantum-coin-js-sdk..openWalletFromSeedWords) ⇒ <code>Wallet</code>
    * [~deserializeEncryptedWallet(walletJsonString, passphrase)](#module_quantum-coin-js-sdk..deserializeEncryptedWallet) ⇒ <code>Wallet</code>
    * [~serializeEncryptedWallet(wallet, passphrase)](#module_quantum-coin-js-sdk..serializeEncryptedWallet) ⇒ <code>string</code>
    * [~verifyWallet(wallet)](#module_quantum-coin-js-sdk..verifyWallet) ⇒ <code>boolean</code>
    * [~serializeWallet(wallet)](#module_quantum-coin-js-sdk..serializeWallet) ⇒ <code>string</code>
    * [~deserializeWallet(walletJson)](#module_quantum-coin-js-sdk..deserializeWallet) ⇒ <code>Wallet</code>
    * [~postTransaction(txnData)](#module_quantum-coin-js-sdk..postTransaction) ⇒ <code>Promise.&lt;SendResult&gt;</code>
    * [~getLatestBlockDetails()](#module_quantum-coin-js-sdk..getLatestBlockDetails) ⇒ <code>Promise.&lt;LatestBlockDetailsResult&gt;</code>
    * [~getAccountDetails(address)](#module_quantum-coin-js-sdk..getAccountDetails) ⇒ <code>Promise.&lt;AccountDetailsResult&gt;</code>
    * [~getTransactionDetails(txnHash)](#module_quantum-coin-js-sdk..getTransactionDetails) ⇒ <code>Promise.&lt;TransactionDetailsResult&gt;</code>
    * [~listAccountTransactions(address, pageNumber)](#module_quantum-coin-js-sdk..listAccountTransactions) ⇒ <code>Promise.&lt;ListAccountTransactionsResponse&gt;</code>
    * [~signSendCoinTransaction(wallet, toAddress, coins, nonce)](#module_quantum-coin-js-sdk..signSendCoinTransaction) ⇒ <code>SignResult</code>
    * [~sendCoins(wallet, toAddress, coins, nonce)](#module_quantum-coin-js-sdk..sendCoins) ⇒ <code>Promise.&lt;SendResult&gt;</code>
    * [~publicKeyFromSignature(digest, signature)](#module_quantum-coin-js-sdk..publicKeyFromSignature) ⇒ <code>string</code>
    * [~publicKeyFromPrivateKey(privateKey)](#module_quantum-coin-js-sdk..publicKeyFromPrivateKey) ⇒ <code>string</code>
    * [~addressFromPublicKey(publicKey)](#module_quantum-coin-js-sdk..addressFromPublicKey) ⇒ <code>string</code>
    * [~combinePublicKeySignature(publicKey, signature)](#module_quantum-coin-js-sdk..combinePublicKeySignature) ⇒ <code>string</code>

<a name="module_quantum-coin-js-sdk..Config"></a>

### quantum-coin-js-sdk~Config
This is the configuration class required to initialize and interact with Quantum Coin blockchain

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~Config](#module_quantum-coin-js-sdk..Config)
    * [new Config(readUrl, writeUrl, chainId, readApiKey, writeApiKey)](#new_module_quantum-coin-js-sdk..Config_new)
    * [.readUrl](#module_quantum-coin-js-sdk..Config+readUrl) : <code>string</code>
    * [.writeUrl](#module_quantum-coin-js-sdk..Config+writeUrl) : <code>string</code>
    * [.chainId](#module_quantum-coin-js-sdk..Config+chainId) : <code>number</code>
    * [.readApiKey](#module_quantum-coin-js-sdk..Config+readApiKey) : <code>string</code>
    * [.writeApiKey](#module_quantum-coin-js-sdk..Config+writeApiKey) : <code>string</code>

<a name="new_module_quantum-coin-js-sdk..Config_new"></a>

#### new Config(readUrl, writeUrl, chainId, readApiKey, writeApiKey)
Creates a config class


| Param | Type | Description |
| --- | --- | --- |
| readUrl | <code>string</code> | The Read API URL pointing to a read relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay. The following URLs are community maintained. Please use your own relay service. Mainnet: https://sdk.readrelay.quantumcoinapi.com |
| writeUrl | <code>string</code> | The Write API URL pointing to a write relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay. The following URLs are community maintained. Please use your own relay service. Mainnet: https://sdk.writerelay.quantumcoinapi.com |
| chainId | <code>number</code> | The chain id of the blockchain. Mainnet chainId is 123123. Testnet T4 chainId is 310324. |
| readApiKey | <code>string</code> | Optional parameter if authorization is enabled for the relay service. API Key for authorization. Defaults to null which indicates no authorization. |
| writeApiKey | <code>string</code> | Optional parameter if authorization is enabled for the relay service. API Key for authorization. Defaults to null which indicates no authorization. |

<a name="module_quantum-coin-js-sdk..Config+readUrl"></a>

#### config.readUrl : <code>string</code>
The Read API URL pointing to a read relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay

**Kind**: instance property of [<code>Config</code>](#module_quantum-coin-js-sdk..Config)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..Config+writeUrl"></a>

#### config.writeUrl : <code>string</code>
The Read API URL pointing to a read relay. See https://github.com/quantumcoinproject/quantum-coin-go/tree/dogep/relay

**Kind**: instance property of [<code>Config</code>](#module_quantum-coin-js-sdk..Config)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..Config+chainId"></a>

#### config.chainId : <code>number</code>
The chain id of the blockchain. Mainnet chainId is 123123. Testnet T4 chainId is 310324.

**Kind**: instance property of [<code>Config</code>](#module_quantum-coin-js-sdk..Config)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..Config+readApiKey"></a>

#### config.readApiKey : <code>string</code>
API Key for authorization if authorization is enabled for the relay service. Defaults to null which indicates no authorization.

**Kind**: instance property of [<code>Config</code>](#module_quantum-coin-js-sdk..Config)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..Config+writeApiKey"></a>

#### config.writeApiKey : <code>string</code>
API Key for authorization if authorization is enabled for the relay service. Defaults to null which indicates no authorization.

**Kind**: instance property of [<code>Config</code>](#module_quantum-coin-js-sdk..Config)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..Wallet"></a>

### quantum-coin-js-sdk~Wallet
This class represents a Wallet. Use the verifyWallet function to verify if a wallet is valid. Verifying the wallet is highly recommended, especially if it comes from an untrusted source. For more details on the underlying cryptography of the Wallet, see https://github.com/QuantumCoinProject/hybrid-pqc

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~Wallet](#module_quantum-coin-js-sdk..Wallet)
    * [new Wallet(address, privateKey, publicKey)](#new_module_quantum-coin-js-sdk..Wallet_new)
    * [.address](#module_quantum-coin-js-sdk..Wallet+address) : <code>string</code>
    * [.privateKey](#module_quantum-coin-js-sdk..Wallet+privateKey) : <code>Array.&lt;number&gt;</code>
    * [.publicKey](#module_quantum-coin-js-sdk..Wallet+publicKey) : <code>Array.&lt;number&gt;</code>

<a name="new_module_quantum-coin-js-sdk..Wallet_new"></a>

#### new Wallet(address, privateKey, publicKey)
Creates a Wallet class. The constructor does not verify the wallet. To verify a wallet, call the verifyWallet function explicitly.


| Param | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | Address of the wallet |
| privateKey | <code>Array.&lt;number&gt;</code> | Private Key byte array of the wallet |
| publicKey | <code>Array.&lt;number&gt;</code> | The chain id of the blockchain. Mainnet chainId is 123123. Testnet T4 chainId is 310324. |

<a name="module_quantum-coin-js-sdk..Wallet+address"></a>

#### wallet.address : <code>string</code>
Address of the wallet. Is 66 bytes in length including 0x (if the wallet is valid).

**Kind**: instance property of [<code>Wallet</code>](#module_quantum-coin-js-sdk..Wallet)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..Wallet+privateKey"></a>

#### wallet.privateKey : <code>Array.&lt;number&gt;</code>
Private Key byte array of the wallet. Is 4064 bytes in length (if the wallet is valid).

**Kind**: instance property of [<code>Wallet</code>](#module_quantum-coin-js-sdk..Wallet)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..Wallet+publicKey"></a>

#### wallet.publicKey : <code>Array.&lt;number&gt;</code>
Public Key byte array of the wallet. Is 1408 bytes in length (if the wallet is valid).

**Kind**: instance property of [<code>Wallet</code>](#module_quantum-coin-js-sdk..Wallet)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..BlockDetails"></a>

### quantum-coin-js-sdk~BlockDetails
This class represents a Block.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..BlockDetails+blockNumber"></a>

#### blockDetails.blockNumber : <code>number</code>
Block Number of the block

**Kind**: instance property of [<code>BlockDetails</code>](#module_quantum-coin-js-sdk..BlockDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..LatestBlockDetailsResult"></a>

### quantum-coin-js-sdk~LatestBlockDetailsResult
This class represents a result from invoking the getLatestBlock function.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~LatestBlockDetailsResult](#module_quantum-coin-js-sdk..LatestBlockDetailsResult)
    * [.resultCode](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+resultCode) : <code>number</code>
    * [.blockDetails](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+blockDetails) : <code>BlockDetails</code>
    * [.response](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+response) : <code>Object</code>
    * [.requestId](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+requestId) : <code>string</code>
    * [.err](#module_quantum-coin-js-sdk..LatestBlockDetailsResult+err) : <code>Error</code>

<a name="module_quantum-coin-js-sdk..LatestBlockDetailsResult+resultCode"></a>

#### latestBlockDetailsResult.resultCode : <code>number</code>
Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.

**Kind**: instance property of [<code>LatestBlockDetailsResult</code>](#module_quantum-coin-js-sdk..LatestBlockDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..LatestBlockDetailsResult+blockDetails"></a>

#### latestBlockDetailsResult.blockDetails : <code>BlockDetails</code>
An object of type BlockDetails representing the block. This value is null if the value of resultCode is not 0.

**Kind**: instance property of [<code>LatestBlockDetailsResult</code>](#module_quantum-coin-js-sdk..LatestBlockDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..LatestBlockDetailsResult+response"></a>

#### latestBlockDetailsResult.response : <code>Object</code>
An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.

**Kind**: instance property of [<code>LatestBlockDetailsResult</code>](#module_quantum-coin-js-sdk..LatestBlockDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..LatestBlockDetailsResult+requestId"></a>

#### latestBlockDetailsResult.requestId : <code>string</code>
An unique id to represent the request. This can be null if request failed before it could be sent.

**Kind**: instance property of [<code>LatestBlockDetailsResult</code>](#module_quantum-coin-js-sdk..LatestBlockDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..LatestBlockDetailsResult+err"></a>

#### latestBlockDetailsResult.err : <code>Error</code>
An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.

**Kind**: instance property of [<code>LatestBlockDetailsResult</code>](#module_quantum-coin-js-sdk..LatestBlockDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetails"></a>

### quantum-coin-js-sdk~AccountDetails
This class represents an Account.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~AccountDetails](#module_quantum-coin-js-sdk..AccountDetails)
    * [.address](#module_quantum-coin-js-sdk..AccountDetails+address) : <code>string</code>
    * [.balance](#module_quantum-coin-js-sdk..AccountDetails+balance) : <code>string</code>
    * [.nonce](#module_quantum-coin-js-sdk..AccountDetails+nonce) : <code>number</code>
    * [.blockNumber](#module_quantum-coin-js-sdk..AccountDetails+blockNumber) : <code>number</code>

<a name="module_quantum-coin-js-sdk..AccountDetails+address"></a>

#### accountDetails.address : <code>string</code>
Address of the wallet. Is 66 bytes in length including 0x.

**Kind**: instance property of [<code>AccountDetails</code>](#module_quantum-coin-js-sdk..AccountDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetails+balance"></a>

#### accountDetails.balance : <code>string</code>
Balance of the account in wei. To convert this to ethers, see https://docs.ethers.org/v4/api-utils.html#ether-strings-and-wei

**Kind**: instance property of [<code>AccountDetails</code>](#module_quantum-coin-js-sdk..AccountDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetails+nonce"></a>

#### accountDetails.nonce : <code>number</code>
A monotonically increasing number representing the nonce of the account. After each transaction from the account that gets registered in the blockchain, the nonce increases by 1.

**Kind**: instance property of [<code>AccountDetails</code>](#module_quantum-coin-js-sdk..AccountDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetails+blockNumber"></a>

#### accountDetails.blockNumber : <code>number</code>
The block number as of which the Account details was retrieved.

**Kind**: instance property of [<code>AccountDetails</code>](#module_quantum-coin-js-sdk..AccountDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetailsResult"></a>

### quantum-coin-js-sdk~AccountDetailsResult
This class represents a result from invoking the getAccountDetails function.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~AccountDetailsResult](#module_quantum-coin-js-sdk..AccountDetailsResult)
    * [.resultCode](#module_quantum-coin-js-sdk..AccountDetailsResult+resultCode) : <code>number</code>
    * [.accountDetails](#module_quantum-coin-js-sdk..AccountDetailsResult+accountDetails) : <code>AccountDetails</code>
    * [.response](#module_quantum-coin-js-sdk..AccountDetailsResult+response) : <code>Object</code>
    * [.requestId](#module_quantum-coin-js-sdk..AccountDetailsResult+requestId) : <code>string</code>
    * [.err](#module_quantum-coin-js-sdk..AccountDetailsResult+err) : <code>Error</code>

<a name="module_quantum-coin-js-sdk..AccountDetailsResult+resultCode"></a>

#### accountDetailsResult.resultCode : <code>number</code>
Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.

**Kind**: instance property of [<code>AccountDetailsResult</code>](#module_quantum-coin-js-sdk..AccountDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetailsResult+accountDetails"></a>

#### accountDetailsResult.accountDetails : <code>AccountDetails</code>
An object of type AccountDetails representing the block. This value is null if the value of resultCode is not 0.

**Kind**: instance property of [<code>AccountDetailsResult</code>](#module_quantum-coin-js-sdk..AccountDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetailsResult+response"></a>

#### accountDetailsResult.response : <code>Object</code>
An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.

**Kind**: instance property of [<code>AccountDetailsResult</code>](#module_quantum-coin-js-sdk..AccountDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetailsResult+requestId"></a>

#### accountDetailsResult.requestId : <code>string</code>
An unique id to represent the request. This can be null if request failed before it could be sent.

**Kind**: instance property of [<code>AccountDetailsResult</code>](#module_quantum-coin-js-sdk..AccountDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountDetailsResult+err"></a>

#### accountDetailsResult.err : <code>Error</code>
An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.

**Kind**: instance property of [<code>AccountDetailsResult</code>](#module_quantum-coin-js-sdk..AccountDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SignResult"></a>

### quantum-coin-js-sdk~SignResult
This class represents a result from invoking the signSendCoinTransaction function.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~SignResult](#module_quantum-coin-js-sdk..SignResult)
    * [.resultCode](#module_quantum-coin-js-sdk..SignResult+resultCode) : <code>number</code>
    * [.txnHash](#module_quantum-coin-js-sdk..SignResult+txnHash) : <code>string</code>
    * [.txnData](#module_quantum-coin-js-sdk..SignResult+txnData) : <code>string</code>

<a name="module_quantum-coin-js-sdk..SignResult+resultCode"></a>

#### signResult.resultCode : <code>number</code>
Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.

**Kind**: instance property of [<code>SignResult</code>](#module_quantum-coin-js-sdk..SignResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SignResult+txnHash"></a>

#### signResult.txnHash : <code>string</code>
Hash of the Transaction, to uniquely identify it. Is 66 bytes in length including 0x. This value is null if the value of resultCode is not 0.

**Kind**: instance property of [<code>SignResult</code>](#module_quantum-coin-js-sdk..SignResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SignResult+txnData"></a>

#### signResult.txnData : <code>string</code>
A payload representing the signed transaction. To actually send a transaction, this payload can then be taken to to a different device that is connected to the blockchain relay and then sent using the postTransaction function. This value is null if the value of resultCode is not 0.

**Kind**: instance property of [<code>SignResult</code>](#module_quantum-coin-js-sdk..SignResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SendResult"></a>

### quantum-coin-js-sdk~SendResult
This class represents a result from invoking the sendCoins function.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~SendResult](#module_quantum-coin-js-sdk..SendResult)
    * [.resultCode](#module_quantum-coin-js-sdk..SendResult+resultCode) : <code>number</code>
    * [.txnHash](#module_quantum-coin-js-sdk..SendResult+txnHash) : <code>string</code>
    * [.response](#module_quantum-coin-js-sdk..SendResult+response) : <code>Object</code>
    * [.requestId](#module_quantum-coin-js-sdk..SendResult+requestId) : <code>string</code>
    * [.err](#module_quantum-coin-js-sdk..SendResult+err) : <code>Error</code>

<a name="module_quantum-coin-js-sdk..SendResult+resultCode"></a>

#### sendResult.resultCode : <code>number</code>
Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.

**Kind**: instance property of [<code>SendResult</code>](#module_quantum-coin-js-sdk..SendResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SendResult+txnHash"></a>

#### sendResult.txnHash : <code>string</code>
Hash of the Transaction, to uniquely identify it. Is 66 bytes in length including 0x. This value is null if the value of resultCode is not 0.

**Kind**: instance property of [<code>SendResult</code>](#module_quantum-coin-js-sdk..SendResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SendResult+response"></a>

#### sendResult.response : <code>Object</code>
An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.

**Kind**: instance property of [<code>SendResult</code>](#module_quantum-coin-js-sdk..SendResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SendResult+requestId"></a>

#### sendResult.requestId : <code>string</code>
An unique id to represent the request. This can be null if request failed before it could be sent.

**Kind**: instance property of [<code>SendResult</code>](#module_quantum-coin-js-sdk..SendResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..SendResult+err"></a>

#### sendResult.err : <code>Error</code>
An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.

**Kind**: instance property of [<code>SendResult</code>](#module_quantum-coin-js-sdk..SendResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionReceipt"></a>

### quantum-coin-js-sdk~TransactionReceipt
This class represents a Receipt of a transaction that is registered in the blockchain. The transactionReceipt field can be null unless the transaction is registered with the blockchain. While the transaction is pending, this field will be null. You should consider the transaction as succeeded only if the status field's value is 0x1 (success).

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~TransactionReceipt](#module_quantum-coin-js-sdk..TransactionReceipt)
    * [.cumulativeGasUsed](#module_quantum-coin-js-sdk..TransactionReceipt+cumulativeGasUsed) : <code>string</code>
    * [.effectiveGasPrice](#module_quantum-coin-js-sdk..TransactionReceipt+effectiveGasPrice) : <code>string</code>
    * [.gasUsed](#module_quantum-coin-js-sdk..TransactionReceipt+gasUsed) : <code>string</code>
    * [.status](#module_quantum-coin-js-sdk..TransactionReceipt+status) : <code>string</code>
    * [.hash](#module_quantum-coin-js-sdk..TransactionReceipt+hash) : <code>string</code>
    * [.type](#module_quantum-coin-js-sdk..TransactionReceipt+type) : <code>string</code>

<a name="module_quantum-coin-js-sdk..TransactionReceipt+cumulativeGasUsed"></a>

#### transactionReceipt.cumulativeGasUsed : <code>string</code>
A hexadecimal string representing the total amount of gas used when this transaction was executed in the block.

**Kind**: instance property of [<code>TransactionReceipt</code>](#module_quantum-coin-js-sdk..TransactionReceipt)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionReceipt+effectiveGasPrice"></a>

#### transactionReceipt.effectiveGasPrice : <code>string</code>
A hexadecimal string representing the sum of the base fee and tip paid per unit of gas.

**Kind**: instance property of [<code>TransactionReceipt</code>](#module_quantum-coin-js-sdk..TransactionReceipt)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionReceipt+gasUsed"></a>

#### transactionReceipt.gasUsed : <code>string</code>
A hexadecimal string representing the amount of gas used by this specific transaction alone.

**Kind**: instance property of [<code>TransactionReceipt</code>](#module_quantum-coin-js-sdk..TransactionReceipt)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionReceipt+status"></a>

#### transactionReceipt.status : <code>string</code>
A hexadecimal string representing either 0x1 (success) or 0x0 (failure). Failed transactions can also incur gas fee. You should consider the transaction as succeeded only if the status value is 0x1 (success).

**Kind**: instance property of [<code>TransactionReceipt</code>](#module_quantum-coin-js-sdk..TransactionReceipt)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionReceipt+hash"></a>

#### transactionReceipt.hash : <code>string</code>
Hash of the Transaction, to uniquely identify it. Is 66 bytes in length including 0x.

**Kind**: instance property of [<code>TransactionReceipt</code>](#module_quantum-coin-js-sdk..TransactionReceipt)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionReceipt+type"></a>

#### transactionReceipt.type : <code>string</code>
A hexadecimal string representing the transaction type. 0x0 is DefaultFeeTxType.

**Kind**: instance property of [<code>TransactionReceipt</code>](#module_quantum-coin-js-sdk..TransactionReceipt)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails"></a>

### quantum-coin-js-sdk~TransactionDetails
This class represents details of a transaction. You should consider the transaction as succeeded only if the status field of the receipt object is 0x1 (success).

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~TransactionDetails](#module_quantum-coin-js-sdk..TransactionDetails)
    * [.blockHash](#module_quantum-coin-js-sdk..TransactionDetails+blockHash) : <code>string</code>
    * [.blockNumber](#module_quantum-coin-js-sdk..TransactionDetails+blockNumber) : <code>number</code>
    * [.from](#module_quantum-coin-js-sdk..TransactionDetails+from) : <code>string</code>
    * [.gas](#module_quantum-coin-js-sdk..TransactionDetails+gas) : <code>string</code>
    * [.gasPrice](#module_quantum-coin-js-sdk..TransactionDetails+gasPrice) : <code>string</code>
    * [.hash](#module_quantum-coin-js-sdk..TransactionDetails+hash) : <code>string</code>
    * [.input](#module_quantum-coin-js-sdk..TransactionDetails+input) : <code>string</code>
    * [.nonce](#module_quantum-coin-js-sdk..TransactionDetails+nonce) : <code>number</code>
    * [.to](#module_quantum-coin-js-sdk..TransactionDetails+to) : <code>string</code>
    * [.value](#module_quantum-coin-js-sdk..TransactionDetails+value) : <code>string</code>
    * [.receipt](#module_quantum-coin-js-sdk..TransactionDetails+receipt) : <code>TransactionReceipt</code>

<a name="module_quantum-coin-js-sdk..TransactionDetails+blockHash"></a>

#### transactionDetails.blockHash : <code>string</code>
A hexadecimal string representing the hash of the block that registered the transaction. This field can be null if the transaction was not registered in the blockchain.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+blockNumber"></a>

#### transactionDetails.blockNumber : <code>number</code>
The number of the block that registered the transaction. This field can be null if the transaction was not registered in the blockchain.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+from"></a>

#### transactionDetails.from : <code>string</code>
A 66 character hexadecimal string representing the address the transaction is sent from.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+gas"></a>

#### transactionDetails.gas : <code>string</code>
A hexadecimal string representing the gas provided for the transaction execution.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+gasPrice"></a>

#### transactionDetails.gasPrice : <code>string</code>
A hexadecimal string representing the gasPrice used for each paid gas, in Wei.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+hash"></a>

#### transactionDetails.hash : <code>string</code>
A 66 character hexadecimal string representing the hash of the transaction.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+input"></a>

#### transactionDetails.input : <code>string</code>
A hexadecimal string representing the compiled code of a contract OR the hash of the invoked method signature and encoded parameters.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+nonce"></a>

#### transactionDetails.nonce : <code>number</code>
A monotonically increasing number representing the nonce of the account. After each transaction from the account that gets registered in the blockchain, the nonce increases by 1.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+to"></a>

#### transactionDetails.to : <code>string</code>
A 66 character hexadecimal string representing address the transaction is directed to.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+value"></a>

#### transactionDetails.value : <code>string</code>
A hexadecimal string representing the value sent with this transaction. The value can be 0 for smart contract transactions, since it only represents the number of coins sent.

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetails+receipt"></a>

#### transactionDetails.receipt : <code>TransactionReceipt</code>
The receipt of the transaction. This field will be null while the transaction is pending (not yet registered in the blockchain).

**Kind**: instance property of [<code>TransactionDetails</code>](#module_quantum-coin-js-sdk..TransactionDetails)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetailsResult"></a>

### quantum-coin-js-sdk~TransactionDetailsResult
This class represents a result from invoking the getTransactionDetails function. If transactions get discarded by the blockchain, for reasons such as due to lower than minimum gas fees or invalid nonce, the resultCode will always contain a non-zero value (failure).

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~TransactionDetailsResult](#module_quantum-coin-js-sdk..TransactionDetailsResult)
    * [.resultCode](#module_quantum-coin-js-sdk..TransactionDetailsResult+resultCode) : <code>number</code>
    * [.transactionDetails](#module_quantum-coin-js-sdk..TransactionDetailsResult+transactionDetails) : <code>TransactionDetails</code>
    * [.response](#module_quantum-coin-js-sdk..TransactionDetailsResult+response) : <code>Object</code>
    * [.requestId](#module_quantum-coin-js-sdk..TransactionDetailsResult+requestId) : <code>string</code>
    * [.err](#module_quantum-coin-js-sdk..TransactionDetailsResult+err) : <code>Error</code>

<a name="module_quantum-coin-js-sdk..TransactionDetailsResult+resultCode"></a>

#### transactionDetailsResult.resultCode : <code>number</code>
Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.

**Kind**: instance property of [<code>TransactionDetailsResult</code>](#module_quantum-coin-js-sdk..TransactionDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetailsResult+transactionDetails"></a>

#### transactionDetailsResult.transactionDetails : <code>TransactionDetails</code>
An object of type TransactionDetails representing the transaction. This value is null if the value of resultCode is not 0.

**Kind**: instance property of [<code>TransactionDetailsResult</code>](#module_quantum-coin-js-sdk..TransactionDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetailsResult+response"></a>

#### transactionDetailsResult.response : <code>Object</code>
An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.

**Kind**: instance property of [<code>TransactionDetailsResult</code>](#module_quantum-coin-js-sdk..TransactionDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetailsResult+requestId"></a>

#### transactionDetailsResult.requestId : <code>string</code>
An unique id to represent the request. This can be null if request failed before it could be sent.

**Kind**: instance property of [<code>TransactionDetailsResult</code>](#module_quantum-coin-js-sdk..TransactionDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..TransactionDetailsResult+err"></a>

#### transactionDetailsResult.err : <code>Error</code>
An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.

**Kind**: instance property of [<code>TransactionDetailsResult</code>](#module_quantum-coin-js-sdk..TransactionDetailsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionCompact"></a>

### quantum-coin-js-sdk~AccountTransactionCompact
This class represents a transaction of an account. You should consider the transaction as succeeded only if the status field is 0x1 (success).

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~AccountTransactionCompact](#module_quantum-coin-js-sdk..AccountTransactionCompact)
    * [.blockNumber](#module_quantum-coin-js-sdk..AccountTransactionCompact+blockNumber) : <code>number</code>
    * [.from](#module_quantum-coin-js-sdk..AccountTransactionCompact+from) : <code>string</code>
    * [.hash](#module_quantum-coin-js-sdk..AccountTransactionCompact+hash) : <code>string</code>
    * [.to](#module_quantum-coin-js-sdk..AccountTransactionCompact+to) : <code>string</code>
    * [.value](#module_quantum-coin-js-sdk..AccountTransactionCompact+value) : <code>string</code>
    * [.status](#module_quantum-coin-js-sdk..AccountTransactionCompact+status) : <code>string</code>

<a name="module_quantum-coin-js-sdk..AccountTransactionCompact+blockNumber"></a>

#### accountTransactionCompact.blockNumber : <code>number</code>
The number of the block that registered the transaction. This field can be null if the transaction was not registered in the blockchain.

**Kind**: instance property of [<code>AccountTransactionCompact</code>](#module_quantum-coin-js-sdk..AccountTransactionCompact)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionCompact+from"></a>

#### accountTransactionCompact.from : <code>string</code>
A 66 character hexadecimal string representing the address the transaction is sent from.

**Kind**: instance property of [<code>AccountTransactionCompact</code>](#module_quantum-coin-js-sdk..AccountTransactionCompact)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionCompact+hash"></a>

#### accountTransactionCompact.hash : <code>string</code>
A 66 character hexadecimal string representing the hash of the transaction.

**Kind**: instance property of [<code>AccountTransactionCompact</code>](#module_quantum-coin-js-sdk..AccountTransactionCompact)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionCompact+to"></a>

#### accountTransactionCompact.to : <code>string</code>
A 66 character hexadecimal string representing address the transaction is directed to.

**Kind**: instance property of [<code>AccountTransactionCompact</code>](#module_quantum-coin-js-sdk..AccountTransactionCompact)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionCompact+value"></a>

#### accountTransactionCompact.value : <code>string</code>
A hexadecimal string representing the value sent with this transaction. The value can be 0 for smart contract transactions, since it only represents the number of coins sent.

**Kind**: instance property of [<code>AccountTransactionCompact</code>](#module_quantum-coin-js-sdk..AccountTransactionCompact)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionCompact+status"></a>

#### accountTransactionCompact.status : <code>string</code>
A hexadecimal string representing either 0x1 (success) or 0x0 (failure). Failed transactions can also incur gas fee. You should consider the transaction as succeeded only if the status value is 0x1 (success).

**Kind**: instance property of [<code>AccountTransactionCompact</code>](#module_quantum-coin-js-sdk..AccountTransactionCompact)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..ListAccountTransactionsResponse"></a>

### quantum-coin-js-sdk~ListAccountTransactionsResponse
This class represents a list of account transactions returned by the listAccountTransactionDetails function.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~ListAccountTransactionsResponse](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse)
    * [.pageCount](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse+pageCount) : <code>number</code>
    * [.items](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse+items) : <code>AccountTransactionCompact</code> \| <code>Array</code>

<a name="module_quantum-coin-js-sdk..ListAccountTransactionsResponse+pageCount"></a>

#### listAccountTransactionsResponse.pageCount : <code>number</code>
The number of pages available for listing.

**Kind**: instance property of [<code>ListAccountTransactionsResponse</code>](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..ListAccountTransactionsResponse+items"></a>

#### listAccountTransactionsResponse.items : <code>AccountTransactionCompact</code> \| <code>Array</code>
An array of type AccountTransactionCompact, containing the list of transactions. Can be null if no items are available.

**Kind**: instance property of [<code>ListAccountTransactionsResponse</code>](#module_quantum-coin-js-sdk..ListAccountTransactionsResponse)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionsResult"></a>

### quantum-coin-js-sdk~AccountTransactionsResult
This class represents a result from invoking the listAccountTransactionDetails function.

**Kind**: inner class of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Access**: public  

* [~AccountTransactionsResult](#module_quantum-coin-js-sdk..AccountTransactionsResult)
    * [.resultCode](#module_quantum-coin-js-sdk..AccountTransactionsResult+resultCode) : <code>number</code>
    * [.listAccountTransactionsResponse](#module_quantum-coin-js-sdk..AccountTransactionsResult+listAccountTransactionsResponse) : <code>ListAccountTransactionsResponse</code>
    * [.response](#module_quantum-coin-js-sdk..AccountTransactionsResult+response) : <code>Object</code>
    * [.requestId](#module_quantum-coin-js-sdk..AccountTransactionsResult+requestId) : <code>string</code>
    * [.err](#module_quantum-coin-js-sdk..AccountTransactionsResult+err) : <code>Error</code>

<a name="module_quantum-coin-js-sdk..AccountTransactionsResult+resultCode"></a>

#### accountTransactionsResult.resultCode : <code>number</code>
Represents the result of the operation. A value of 0 represents that the operation succeeded. Any other value indicates the operation failed. See the result code section for more details.

**Kind**: instance property of [<code>AccountTransactionsResult</code>](#module_quantum-coin-js-sdk..AccountTransactionsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionsResult+listAccountTransactionsResponse"></a>

#### accountTransactionsResult.listAccountTransactionsResponse : <code>ListAccountTransactionsResponse</code>
An object of type ListAccountTransactionsResponse representing the list of transactions along with metadata. This value is null if the value of resultCode is not 0.

**Kind**: instance property of [<code>AccountTransactionsResult</code>](#module_quantum-coin-js-sdk..AccountTransactionsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionsResult+response"></a>

#### accountTransactionsResult.response : <code>Object</code>
An object of representing the raw Response returned by the service. For details, see https://developer.mozilla.org/en-US/docs/Web/API/Response. This value can be null if the value of resultCode is not 0.

**Kind**: instance property of [<code>AccountTransactionsResult</code>](#module_quantum-coin-js-sdk..AccountTransactionsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionsResult+requestId"></a>

#### accountTransactionsResult.requestId : <code>string</code>
An unique id to represent the request. This can be null if request failed before it could be sent.

**Kind**: instance property of [<code>AccountTransactionsResult</code>](#module_quantum-coin-js-sdk..AccountTransactionsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..AccountTransactionsResult+err"></a>

#### accountTransactionsResult.err : <code>Error</code>
An error object if the operation resulted in an error and there was no response. This property is defined only if the resultCode is -10000.

**Kind**: instance property of [<code>AccountTransactionsResult</code>](#module_quantum-coin-js-sdk..AccountTransactionsResult)  
**Access**: public  
<a name="module_quantum-coin-js-sdk..initialize"></a>

### quantum-coin-js-sdk~initialize(clientConfig) ⇒ <code>Promise.&lt;boolean&gt;</code>
The initialize function has to be called before attempting to invoke any other function. This function should be called only once.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Returns a promise of type boolean; true if the initialization succeeded, else false.  

| Param | Type | Description |
| --- | --- | --- |
| clientConfig | <code>Config</code> | A configuration represented by the Config class |

<a name="module_quantum-coin-js-sdk..isAddressValid"></a>

### quantum-coin-js-sdk~isAddressValid(address) ⇒ <code>boolean</code>
The isAddressValid function validates whether an address is valid or not. An address is of length 66 characters including 0x.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>boolean</code> - Returns true if the address validation succeeded, else returns false.  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | A string representing the address to validate. |

<a name="module_quantum-coin-js-sdk..newWallet"></a>

### quantum-coin-js-sdk~newWallet() ⇒ <code>Wallet</code>
The newWallet function creates a new Wallet.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Wallet</code> - Returns a Wallet object.  
<a name="module_quantum-coin-js-sdk..newWalletSeed"></a>

### quantum-coin-js-sdk~newWalletSeed() ⇒ <code>array</code>
The newWalletSeed function creates a new Wallet seed word list. The return array can then be passed to the openWalletFromSeedWords function to create a new wallet.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>array</code> - Returns an array of seed words (48 words in total). Returns null if the operation failed.  
<a name="module_quantum-coin-js-sdk..openWalletFromSeedWords"></a>

### quantum-coin-js-sdk~openWalletFromSeedWords(seedWordList) ⇒ <code>Wallet</code>
The openWalletFromSeedWords function creates a wallet from a seed word list. The seed word list is available for wallets created from Desktop/Web/Mobile wallets.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Wallet</code> - Returns a Wallet object. Returns null if the operation failed.  

| Param | Type | Description |
| --- | --- | --- |
| seedWordList | <code>array</code> | An array of seed words. There should be 48 words in total. |

<a name="module_quantum-coin-js-sdk..deserializeEncryptedWallet"></a>

### quantum-coin-js-sdk~deserializeEncryptedWallet(walletJsonString, passphrase) ⇒ <code>Wallet</code>
The deserializeEncryptedWallet function opens a wallet backed-up using an application such as the Desktop/Mobile/CLI/Web wallet. This function can take upto a minute or so to execute. You should open wallets only from trusted sources.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Wallet</code> - Returns a Wallet object. Returns null if opening the wallet fails.  

| Param | Type | Description |
| --- | --- | --- |
| walletJsonString | <code>string</code> | The json string from a wallet file. |
| passphrase | <code>string</code> | The passphrase used to encrypt the wallet. |

<a name="module_quantum-coin-js-sdk..serializeEncryptedWallet"></a>

### quantum-coin-js-sdk~serializeEncryptedWallet(wallet, passphrase) ⇒ <code>string</code>
The serializeEncryptedWallet function encrypts and serializes a Wallet object to a JSON string readable by the Desktop/Mobile/Web/CLI wallet applications. You can save this string to a file and open the file in one of these wallet applications. You may also open this string using the deserializeEncryptedWallet function. If you loose the passphrase, you will be unable to open the wallet. This function can take upto a minute or so to execute.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>string</code> - Returns the Wallet in JSON string format. If the wallet is invalid, null is returned.  

| Param | Type | Description |
| --- | --- | --- |
| wallet | <code>Wallet</code> | A Wallet object representing the wallet to serialize. |
| passphrase | <code>string</code> | A passphrase used to encrypt the wallet. It should atleast be 12 characters long. |

<a name="module_quantum-coin-js-sdk..verifyWallet"></a>

### quantum-coin-js-sdk~verifyWallet(wallet) ⇒ <code>boolean</code>
The verifyWallet function verifies whether a Wallet is valid or not. To mitigate spoofing and other attachs, it is highly recommended to verify a wallet, especially if it is from an untrusted source.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>boolean</code> - Returns true if the Wallet verification succeeded, else returns false.  

| Param | Type | Description |
| --- | --- | --- |
| wallet | <code>Wallet</code> | A Wallet object representing the wallet to verify. |

<a name="module_quantum-coin-js-sdk..serializeWallet"></a>

### quantum-coin-js-sdk~serializeWallet(wallet) ⇒ <code>string</code>
The serializeWallet function serializes a Wallet object to a JSON string. You should encrypt the string before saving it to disk or a database.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>string</code> - Returns the Wallet in JSON string format. If the wallet is invalid, null is returned.  

| Param | Type | Description |
| --- | --- | --- |
| wallet | <code>Wallet</code> | A Wallet object representing the wallet to serialize. |

<a name="module_quantum-coin-js-sdk..deserializeWallet"></a>

### quantum-coin-js-sdk~deserializeWallet(walletJson) ⇒ <code>Wallet</code>
The deserializeWallet function creates a Wallet object from a JSON string.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Wallet</code> - Returns the Wallet corresponding to the walletJson. If the wallet is invalid, null is returned.  

| Param | Type | Description |
| --- | --- | --- |
| walletJson | <code>string</code> | A Wallet object representing the wallet to deserialize. |

<a name="module_quantum-coin-js-sdk..postTransaction"></a>

### quantum-coin-js-sdk~postTransaction(txnData) ⇒ <code>Promise.&lt;SendResult&gt;</code>
The postTransaction function posts a signed transaction to the blockchain. This method can be used in conjunction with the signSendCoinTransaction method to submit a transaction that was signed using a cold wallet (offline or disconnected or air-gapped wallet).

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Promise.&lt;SendResult&gt;</code> - Returns a promise of type SendResult. txnHash will be null in SendResult.  

| Param | Type | Description |
| --- | --- | --- |
| txnData | <code>string</code> | A signed transaction string returned by the signSendCoinTransaction function. |

<a name="module_quantum-coin-js-sdk..getLatestBlockDetails"></a>

### quantum-coin-js-sdk~getLatestBlockDetails() ⇒ <code>Promise.&lt;LatestBlockDetailsResult&gt;</code>
The getLatestBlockDetails function returns details of the latest block of the blockchain.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Promise.&lt;LatestBlockDetailsResult&gt;</code> - Returns a promise of an object of type BlockDetailsResult.  
<a name="module_quantum-coin-js-sdk..getAccountDetails"></a>

### quantum-coin-js-sdk~getAccountDetails(address) ⇒ <code>Promise.&lt;AccountDetailsResult&gt;</code>
The getAccountDetails function returns details of an account corresponding to the address.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Promise.&lt;AccountDetailsResult&gt;</code> - Returns a promise of type AccountDetailsResult.  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | The address of the account of which the details have to be retrieved. |

<a name="module_quantum-coin-js-sdk..getTransactionDetails"></a>

### quantum-coin-js-sdk~getTransactionDetails(txnHash) ⇒ <code>Promise.&lt;TransactionDetailsResult&gt;</code>
The getTransactionDetails function returns details of a transaction posted to the blockchain. Transactions may take a while to get registered in the blockchain. After a transaction is submitted, it may take a while before it is available for reading.Some transactions that have lower balance than the minimum required for gas fees may be discarded. In these cases, the transactions may not be returned when invoking the getTransactionDetails function. You should consider the transaction as succeeded only if the status field of the transactionReceipt object is 0x1 (success). The transactionReceipt field can be null unless the transaction is registered with the blockchain.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Promise.&lt;TransactionDetailsResult&gt;</code> - Returns a promise of type type TransactionDetailsResult.  

| Param | Type | Description |
| --- | --- | --- |
| txnHash | <code>string</code> | The hash of the transaction to retrieve. |

<a name="module_quantum-coin-js-sdk..listAccountTransactions"></a>

### quantum-coin-js-sdk~listAccountTransactions(address, pageNumber) ⇒ <code>Promise.&lt;ListAccountTransactionsResponse&gt;</code>
The listAccountTransactions function returns a list of transactions for a specific account. Transactions may take a while to get registered in the blockchain. After a transaction is submitted, it may take a while before it is available for listing.Some transactions that have lower balance than the minimum required for gas fees may be discarded. In these cases, the transactions may not be returned when invoking the listAccountTransactions function. You should consider the transaction as succeeded only if the status field AccountDetailsCompact object is 0x1 (success). Both transactions from and transactions to the address will be returned in the list.Use the getTransactionDetails function, passing the hash of the transaction to get detailed information about the transaction.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Promise.&lt;ListAccountTransactionsResponse&gt;</code> - Returns a promise of type type ListAccountTransactionsResponse.  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | The address for which the transactions have to be listed. |
| pageNumber | <code>number</code> | The page number for which the transactions has to be listed for the account. Pass 0 to list the latest page. Pass 1 to list the oldest page. A maximum of 20 transactions are returned in each page. The response of this API includes a field that shows the pageCount (total number of pages available). You can pass any number between 1 to pageCount to get the corresponding page. |

<a name="module_quantum-coin-js-sdk..signSendCoinTransaction"></a>

### quantum-coin-js-sdk~signSendCoinTransaction(wallet, toAddress, coins, nonce) ⇒ <code>SignResult</code>
The signSendCoinTransaction function returns a signed transaction. Since the gas fee for sending coins is fixed at 1000 coins, there is no option to set the gas fee explicitly.This function is useful for offline (cold storage) wallets, where you can sign a transaction offline and then use the postTransaction function to post it on a connected device.Another usecase for this function is when you want to first store a signed transaction to a database, then queue it and finally submit the transaction by calling the postTransaction function.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>SignResult</code> - Returns a promise of type SignResult.  

| Param | Type | Description |
| --- | --- | --- |
| wallet | <code>Wallet</code> | A Wallet object from which the transaction has to be sent. The address corresponding to the Wallet should have enough coins to cover gas fees as well. A minimum of 1000 coins (1000000000000000000000 wei) are required for gas fees. |
| toAddress | <code>string</code> | The address to which the coins should be sent. |
| coins | <code>string</code> | The string representing the number of coins (in ether) to send. To convert between ethers and wei, see https://docs.ethers.org/v4/api-utils.html#ether-strings-and-wei |
| nonce | <code>number</code> | The nonce of the account retrieved by invoking the getAccountDetails function. You have to carefully manage state of the nonce to avoid sending the coins multiple times, such as when retrying sendCoins after a network error. |

<a name="module_quantum-coin-js-sdk..sendCoins"></a>

### quantum-coin-js-sdk~sendCoins(wallet, toAddress, coins, nonce) ⇒ <code>Promise.&lt;SendResult&gt;</code>
The sendCoins function posts a send-coin transaction to the blockchain. Since the gas fee for sending coins is fixed at 1000 coins, there is no option to set the gas fee explicitly.It may take many seconds after submitting a transaction before the transaction is returned by the getTransactionDetails function. Transactions are usually committed in less than 30 seconds.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>Promise.&lt;SendResult&gt;</code> - Returns a promise of type SendResult.  

| Param | Type | Description |
| --- | --- | --- |
| wallet | <code>Wallet</code> | A Wallet object from which the transaction has to be sent. The address corresponding to the Wallet should have enough coins to cover gas fees as well. A minimum of 1000 coins (1000000000000000000000 wei) are required for gas fees. |
| toAddress | <code>string</code> | The address to which the coins should be sent. |
| coins | <code>string</code> | The string representing the number of coins (in ether) to send. To convert between ethers and wei, see https://docs.ethers.org/v4/api-utils.html#ether-strings-and-wei |
| nonce | <code>number</code> | The nonce of the account retrieved by invoking the getAccountDetails function. You have to carefully manage state of the nonce to avoid sending the coins multiple times, such as when retrying sendCoins after a network error. |

<a name="module_quantum-coin-js-sdk..publicKeyFromSignature"></a>

### quantum-coin-js-sdk~publicKeyFromSignature(digest, signature) ⇒ <code>string</code>
The publicKeyFromSignature extracts the public key from a signature.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>string</code> - - Returns the public key as a hex string. Returns null if the operation failed.  

| Param | Type | Description |
| --- | --- | --- |
| digest | <code>Array.&lt;number&gt;</code> | An array of bytes containing the digestHash. Should be of length 32. |
| signature | <code>Array.&lt;number&gt;</code> | An array of bytes containing the signature. |

<a name="module_quantum-coin-js-sdk..publicKeyFromPrivateKey"></a>

### quantum-coin-js-sdk~publicKeyFromPrivateKey(privateKey) ⇒ <code>string</code>
The publicKeyFromPrivateKey extracts the public key from a private key.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>string</code> - - Returns the public key as a hex string. Returns null if the operation failed.  

| Param | Type | Description |
| --- | --- | --- |
| privateKey | <code>Array.&lt;number&gt;</code> | An array of bytes containing the privateKey. |

<a name="module_quantum-coin-js-sdk..addressFromPublicKey"></a>

### quantum-coin-js-sdk~addressFromPublicKey(publicKey) ⇒ <code>string</code>
The addressFromPublicKey returns the address corresponding to the public key.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>string</code> - - Returns the address corresponding to the public key as a hex string. Returns null if the operation failed.  

| Param | Type | Description |
| --- | --- | --- |
| publicKey | <code>Array.&lt;number&gt;</code> | An array of bytes containing the public key. |

<a name="module_quantum-coin-js-sdk..combinePublicKeySignature"></a>

### quantum-coin-js-sdk~combinePublicKeySignature(publicKey, signature) ⇒ <code>string</code>
The combinePublicKeySignature combines the public key and signature.

**Kind**: inner method of [<code>quantum-coin-js-sdk</code>](#module_quantum-coin-js-sdk)  
**Returns**: <code>string</code> - - Returns a hex string corresponding to combined signature. Returns null if the operation failed.  

| Param | Type | Description |
| --- | --- | --- |
| publicKey | <code>Array.&lt;number&gt;</code> | An array of bytes containing the public key. |
| signature | <code>Array.&lt;number&gt;</code> | An array of bytes containing the signature. |

