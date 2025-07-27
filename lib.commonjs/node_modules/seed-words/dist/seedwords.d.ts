/**
 * The initialize function has to be called before attempting to invoke any other function. This function should be called only once.
 *
 * @async
 * @function initialize
 * @return {Promise<boolean>} Returns a promise of type boolean; true if the initialization succeeded, else false.
 */
export function initialize(): Promise<boolean>;
/**
 * The getWordListFromSeedArray function returns the word list corresponding to a byte array.
 *
 * @function getWordListFromSeedArray
 * @param {array} seedArray - An array of bytes. This array should have an even number of elements.
 * @return {array} Returns the array of words (string) corresponding to the input seed array. Returns null on failure. This function can fail if the seedArray is invalid or initialize() hasn't been called.
 */
export function getWordListFromSeedArray(seedArray: any[]): any[];
/**
 * The doesSeedWordExist function returns the word list corresponding to a byte array.
 *
 * @function doesSeedWordExist
 * @param {string} word - A seed word to find whether it exists in the list or not.
 * @return {boolean} Returns true if the seed word exists. Returns false if it doesn't exist. Returns null on failure. This function can fail if initialize() function was not called.
 */
export function doesSeedWordExist(word: string): boolean;
/**
 * The getAllSeedWords function returns all the seed words in an array.
 *
 * @function getAllSeedWords
 * @return {array} Returns an array with the list of all seed words.
 */
export function getAllSeedWords(): any[];
/**
 * The getSeedArrayFromWordList function a byte array that corresponds to the seed word list.
 *
 * @function getSeedArrayFromWordList
 * @param {array} wordList - An array of seed words.
 * @return {array} Returns an array of bytes that correspond to the wordList. Returns null on failure. This function can fail if initialize() function was not called or the word doesn't exist.
 */
export function getSeedArrayFromWordList(wordList: any[]): any[];
