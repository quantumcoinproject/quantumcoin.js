<a name="module_seed-words"></a>

## seed-words
Seed Words is a list of English words to be used in mnemonic seed phrases. There are a total of 256 x 256 = 65536 words. They can be used to represent any arbitrary 2 byte array with a singlehuman-readable word. To represent a 16 byte array, 8 words are required, to represent a 32 byte array, 16 words are required and so on. Seed Words JS SDK provides programmatic access.

**Example**  
```js
Requires Node.js version v20.18.1 or higherInstallation:npm install seed-words --save//Adding reference:var seedwords = require('seed-words');//Initialize the SDK first before invoking any other functionseedwords.initialize().then((initResult) => {     if (initResult === false) {         console.log("error initializing");     } else {        console.log("initialized");     }}
```

* [seed-words](#module_seed-words)
    * [~initialize()](#module_seed-words..initialize) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [~getAllSeedWords()](#module_seed-words..getAllSeedWords) ⇒ <code>array</code>
    * [~getWordListFromSeedArray(seedArray)](#module_seed-words..getWordListFromSeedArray) ⇒ <code>array</code>
    * [~getSeedArrayFromWordList(wordList)](#module_seed-words..getSeedArrayFromWordList) ⇒ <code>array</code>
    * [~doesSeedWordExist(word)](#module_seed-words..doesSeedWordExist) ⇒ <code>boolean</code>

<a name="module_seed-words..initialize"></a>

### seed-words~initialize() ⇒ <code>Promise.&lt;boolean&gt;</code>
The initialize function has to be called before attempting to invoke any other function. This function should be called only once.

**Kind**: inner method of [<code>seed-words</code>](#module_seed-words)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Returns a promise of type boolean; true if the initialization succeeded, else false.  
<a name="module_seed-words..getAllSeedWords"></a>

### seed-words~getAllSeedWords() ⇒ <code>array</code>
The getAllSeedWords function returns all the seed words in an array.

**Kind**: inner method of [<code>seed-words</code>](#module_seed-words)  
**Returns**: <code>array</code> - Returns an array with the list of all seed words.  
<a name="module_seed-words..getWordListFromSeedArray"></a>

### seed-words~getWordListFromSeedArray(seedArray) ⇒ <code>array</code>
The getWordListFromSeedArray function returns the word list corresponding to a byte array.

**Kind**: inner method of [<code>seed-words</code>](#module_seed-words)  
**Returns**: <code>array</code> - Returns the array of words (string) corresponding to the input seed array. Returns null on failure. This function can fail if the seedArray is invalid or initialize() hasn't been called.  

| Param | Type | Description |
| --- | --- | --- |
| seedArray | <code>array</code> | An array of bytes. This array should have an even number of elements. |

<a name="module_seed-words..getSeedArrayFromWordList"></a>

### seed-words~getSeedArrayFromWordList(wordList) ⇒ <code>array</code>
The getSeedArrayFromWordList function a byte array that corresponds to the seed word list.

**Kind**: inner method of [<code>seed-words</code>](#module_seed-words)  
**Returns**: <code>array</code> - Returns an array of bytes that correspond to the wordList. Returns null on failure. This function can fail if initialize() function was not called or the word doesn't exist.  

| Param | Type | Description |
| --- | --- | --- |
| wordList | <code>array</code> | An array of seed words. |

<a name="module_seed-words..doesSeedWordExist"></a>

### seed-words~doesSeedWordExist(word) ⇒ <code>boolean</code>
The doesSeedWordExist function returns the word list corresponding to a byte array.

**Kind**: inner method of [<code>seed-words</code>](#module_seed-words)  
**Returns**: <code>boolean</code> - Returns true if the seed word exists. Returns false if it doesn't exist. Returns null on failure. This function can fail if initialize() function was not called.  

| Param | Type | Description |
| --- | --- | --- |
| word | <code>string</code> | A seed word to find whether it exists in the list or not. |

