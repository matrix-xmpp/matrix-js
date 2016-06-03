/// <reference path="../util/functions.ts" />
// Copyright 2013 Basarat Ali Syed. All Rights Reserved.
//
// Licensed under MIT open source license http://opensource.org/licenses/MIT
//
// Orginal javascript code was by Mauricio Santos

/**
 * @namespace Top level namespace for collections, a TypeScript data structure library.
 */
module Matrix.Collections {
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var has = function (obj, prop) {
        return _hasOwnProperty.call(obj, prop);
    }

    /**
    * Function signature for comparing
    * <0 means a is smaller
    * = 0 means they are equal
    * >0 means a is larger
    */
    export interface ICompareFunction<T> {
        (a: T, b: T): number;
    }

    /**
    * Function signature for checking equality
    */
    export interface IEqualsFunction<T> {
        (a: T, b: T): boolean;
    }

    /**
    * Function signature for Iterations. Return false to break from loop
    */
    export interface ILoopFunction<T> {
        (a: T): boolean;
    }

    /**
     * Default function to compare element order.
     * @function     
     */
    export function defaultCompare<T>(a: T, b: T): number {
        if (a < b) {
            return -1;
        } else if (a === b) {
            return 0;
        } else {
            return 1;
        }
    }

    /**
     * Default function to test equality. 
     * @function     
     */
    export function defaultEquals<T>(a: T, b: T): boolean {
        return a === b;
    }

    /**
     * Default function to convert an object to a string.
     * @function     
     */
    export function defaultToString(item: any): string {
                if (item === null) {
            return 'COLLECTION_NULL';
        } else if (Matrix.Util.Functions.isUndefined(item)) {
            return 'COLLECTION_UNDEFINED';
        } else if (Matrix.Util.Functions.isString(item)) {
            return '$s' + item;
        } else {
            return '$o' + item.toString();
        }
    }

    /**
    * Joins all the properies of the object using the provided join string 
    */
    export function makeString<T>(item: T, join: string = ","): string {
        if (item === null) {
            return 'COLLECTION_NULL';
        } else if (Matrix.Util.Functions.isUndefined(item)) {
            return 'COLLECTION_UNDEFINED';
        } else if (Matrix.Util.Functions.isString(item)) {
            return item.toString();
        } else {
            var toret = "{";
            var first = true;
            for (var prop in item) {
                if (has(item, prop)) {
                    if (first)
                        first = false;
                    else
                        toret = toret + join;
                    toret = toret + prop + ":" + item[prop];
                }
            }
            return toret + "}";
        }
    }

    /**
     * Reverses a compare function.
     * @function
     */
    export function reverseCompareFunction<T>(compareFunction: ICompareFunction<T>): ICompareFunction<T> {
        if (!Matrix.Util.Functions.isFunction(compareFunction)) {
            return function (a, b) {
                if (a < b) {
                    return 1;
                } else if (a === b) {
                    return 0;
                } else {
                    return -1;
                }
            };
        } else {
            return function (d: T, v: T) {
                return compareFunction(d, v) * -1;
            };
        }
    }

    /**
     * Returns an equal function given a compare function.
     * @function
     */
    export function compareToEquals<T>(compareFunction: ICompareFunction<T>): IEqualsFunction<T> {
        return function (a: T, b: T) {
            return compareFunction(a, b) === 0;
        };
    }

    /**
     * @namespace Contains various functions for manipulating arrays.
     */
    //export module arrays {

    //    /**
    //     * Returns the position of the first occurrence of the specified item
    //     * within the specified array.
    //     * @param {*} array the array in which to search the element.
    //     * @param {Object} item the element to search.
    //     * @param {function(Object,Object):boolean=} equalsFunction optional function used to 
    //     * check equality between 2 elements.
    //     * @return {number} the position of the first occurrence of the specified element
    //     * within the specified array, or -1 if not found.
    //     */
    //    export function indexOf<T>(array: T[], item: T, equalsFunction?: Matrix.Collections.IEqualsFunction<T>): number {
    //        var equals = equalsFunction || Matrix.Collections.defaultEquals;
    //        var length = array.length;
    //        for (var i = 0; i < length; i++) {
    //            if (equals(array[i], item)) {
    //                return i;
    //            }
    //        }
    //        return -1;
    //    }

    //    /**
    //     * Returns the position of the last occurrence of the specified element
    //     * within the specified array.
    //     * @param {*} array the array in which to search the element.
    //     * @param {Object} item the element to search.
    //     * @param {function(Object,Object):boolean=} equalsFunction optional function used to 
    //     * check equality between 2 elements.
    //     * @return {number} the position of the last occurrence of the specified element
    //     * within the specified array or -1 if not found.
    //     */
    //    export function lastIndexOf<T>(array: T[], item: T, equalsFunction?: Matrix.Collections.IEqualsFunction<T>): number {
    //        var equals = equalsFunction || Matrix.Collections.defaultEquals;
    //        var length = array.length;
    //        for (var i = length - 1; i >= 0; i--) {
    //            if (equals(array[i], item)) {
    //                return i;
    //            }
    //        }
    //        return -1;
    //    }

    //    /**
    //     * Returns true if the specified array contains the specified element.
    //     * @param {*} array the array in which to search the element.
    //     * @param {Object} item the element to search.
    //     * @param {function(Object,Object):boolean=} equalsFunction optional function to 
    //     * check equality between 2 elements.
    //     * @return {boolean} true if the specified array contains the specified element.
    //     */
    //    export function contains<T>(array: T[], item: T, equalsFunction?: Matrix.Collections.IEqualsFunction<T>): boolean {
    //        return arrays.indexOf(array, item, equalsFunction) >= 0;
    //    }


    //    /**
    //     * Removes the first ocurrence of the specified element from the specified array.
    //     * @param {*} array the array in which to search element.
    //     * @param {Object} item the element to search.
    //     * @param {function(Object,Object):boolean=} equalsFunction optional function to 
    //     * check equality between 2 elements.
    //     * @return {boolean} true if the array changed after this call.
    //     */
    //    export function remove<T>(array: T[], item: T, equalsFunction?: Matrix.Collections.IEqualsFunction<T>): boolean {
    //        var index = arrays.indexOf(array, item, equalsFunction);
    //        if (index < 0) {
    //            return false;
    //        }
    //        array.splice(index, 1);
    //        return true;
    //    }

    //    /**
    //     * Returns the number of elements in the specified array equal
    //     * to the specified object.
    //     * @param {Array} array the array in which to determine the frequency of the element.
    //     * @param {Object} item the element whose frequency is to be determined.
    //     * @param {function(Object,Object):boolean=} equalsFunction optional function used to 
    //     * check equality between 2 elements.
    //     * @return {number} the number of elements in the specified array 
    //     * equal to the specified object.
    //     */
    //    export function frequency<T>(array: T[], item: T, equalsFunction?: Matrix.Collections.IEqualsFunction<T>): number {
    //        var equals = equalsFunction || Matrix.Collections.defaultEquals;
    //        var length = array.length;
    //        var freq = 0;
    //        for (var i = 0; i < length; i++) {
    //            if (equals(array[i], item)) {
    //                freq++;
    //            }
    //        }
    //        return freq;
    //    }

    //    /**
    //     * Returns true if the two specified arrays are equal to one another.
    //     * Two arrays are considered equal if both arrays contain the same number
    //     * of elements, and all corresponding pairs of elements in the two 
    //     * arrays are equal and are in the same order. 
    //     * @param {Array} array1 one array to be tested for equality.
    //     * @param {Array} array2 the other array to be tested for equality.
    //     * @param {function(Object,Object):boolean=} equalsFunction optional function used to 
    //     * check equality between elemements in the arrays.
    //     * @return {boolean} true if the two arrays are equal
    //     */
    //    export function equals<T>(array1: T[], array2: T[], equalsFunction?: Matrix.Collections.IEqualsFunction<T>): boolean {
    //        var equals = equalsFunction || Matrix.Collections.defaultEquals;

    //        if (array1.length !== array2.length) {
    //            return false;
    //        }
    //        var length = array1.length;
    //        for (var i = 0; i < length; i++) {
    //            if (!equals(array1[i], array2[i])) {
    //                return false;
    //            }
    //        }
    //        return true;
    //    }

    //    /**
    //     * Returns shallow a copy of the specified array.
    //     * @param {*} array the array to copy.
    //     * @return {Array} a copy of the specified array
    //     */
    //    export function copy<T>(array: T[]): T[] {
    //        return array.concat();
    //    }

    //    /**
    //     * Swaps the elements at the specified positions in the specified array.
    //     * @param {Array} array The array in which to swap elements.
    //     * @param {number} i the index of one element to be swapped.
    //     * @param {number} j the index of the other element to be swapped.
    //     * @return {boolean} true if the array is defined and the indexes are valid.
    //     */
    //    export function swap<T>(array: T[], i: number, j: number): boolean {
    //        if (i < 0 || i >= array.length || j < 0 || j >= array.length) {
    //            return false;
    //        }
    //        var temp = array[i];
    //        array[i] = array[j];
    //        array[j] = temp;
    //        return true;
    //    }

    //    export function toString<T>(array: T[]): string {
    //        return '[' + array.toString() + ']';
    //    }

    //    /**
    //     * Executes the provided function once for each element present in this array 
    //     * starting from index 0 to length - 1.
    //     * @param {Array} array The array in which to iterate.
    //     * @param {function(Object):*} callback function to execute, it is
    //     * invoked with one argument: the element value, to break the iteration you can 
    //     * optionally return false.
    //     */
    //    export function forEach<T>(array: T[], callback: (item: T) => boolean): void {
    //        var lenght = array.length;
    //        for (var i = 0; i < lenght; i++) {
    //            if (callback(array[i]) === false) {
    //                return;
    //            }
    //        }
    //    }
    //}


    // A linked list node
    export interface ILinkedListNode<T> {
        element: T;
        next: ILinkedListNode<T>;
    }

    export class LinkedList<T> {

        /**
        * First node in the list
        * @type {Object}
        * @private
        */
        public firstNode: ILinkedListNode<T> = null;
        /**
        * Last node in the list
        * @type {Object}
        * @private
        */
        private lastNode: ILinkedListNode<T> = null;

        /**
        * Number of elements in the list
        * @type {number}
        * @private
        */
        private nElements = 0;

        /**
        * Creates an empty Linked List.
        * @class A linked list is a data structure consisting of a group of nodes
        * which together represent a sequence.
        * @constructor
        */
        constructor() {
        }

        /**
        * Adds an element to this list.
        * @param {Object} item element to be added.
        * @param {number=} index optional index to add the element. If no index is specified
        * the element is added to the end of this list.
        * @return {boolean} true if the element was added or false if the index is invalid
        * or if the element is undefined.
        */
        add(item: T, index?: number): boolean {
            if (Matrix.Util.Functions.isUndefined(index)) {
                index = this.nElements;
            }
            if (index < 0 || index > this.nElements || Matrix.Util.Functions.isUndefined(item)) {
                return false;
            }
            var newNode = this.createNode(item);
            if (this.nElements === 0) {
                // First node in the list.
                this.firstNode = newNode;
                this.lastNode = newNode;
            } else if (index === this.nElements) {
                // Insert at the end.
                this.lastNode.next = newNode;
                this.lastNode = newNode;
            } else if (index === 0) {
                // Change first node.
                newNode.next = this.firstNode;
                this.firstNode = newNode;
            } else {
                var prev = this.nodeAtIndex(index - 1);
                newNode.next = prev.next;
                prev.next = newNode;
            }
            this.nElements++;
            return true;
        }

        /**
        * Returns the first element in this list.
        * @return {*} the first element of the list or undefined if the list is
        * empty.
        */
        first(): T {

            if (this.firstNode !== null) {
                return this.firstNode.element;
            }
            return undefined;
        }

        /**
        * Returns the last element in this list.
        * @return {*} the last element in the list or undefined if the list is
        * empty.
        */
        last(): T {

            if (this.lastNode !== null) {
                return this.lastNode.element;
            }
            return undefined;
        }

        /**
         * Returns the element at the specified position in this list.
         * @param {number} index desired index.
         * @return {*} the element at the given index or undefined if the index is
         * out of bounds.
         */
        elementAtIndex(index: number): T {

            var node = this.nodeAtIndex(index);
            if (node === null) {
                return undefined;
            }
            return node.element;
        }

        /**
         * Returns the index in this list of the first occurrence of the
         * specified element, or -1 if the List does not contain this element.
         * <p>If the elements inside this list are
         * not comparable with the === operator a custom equals function should be
         * provided to perform searches, the function must receive two arguments and
         * return true if they are equal, false otherwise. Example:</p>
         *
         * <pre>
         * var petsAreEqualByName = function(pet1, pet2) {
         *  return pet1.name === pet2.name;
         * }
         * </pre>
         * @param {Object} item element to search for.
         * @param {function(Object,Object):boolean=} equalsFunction Optional
         * function used to check if two elements are equal.
         * @return {number} the index in this list of the first occurrence
         * of the specified element, or -1 if this list does not contain the
         * element.
         */
        indexOf(item: T, equalsFunction?: IEqualsFunction<T>): number {

            var equalsF = equalsFunction || Matrix.Collections.defaultEquals;
            if (Matrix.Util.Functions.isUndefined(item)) {
                return -1;
            }
            var currentNode = this.firstNode;
            var index = 0;
            while (currentNode !== null) {
                if (equalsF(currentNode.element, item)) {
                    return index;
                }
                index++;
                currentNode = currentNode.next;
            }
            return -1;
        }


        /**
           * Returns true if this list contains the specified element.
           * <p>If the elements inside the list are
           * not comparable with the === operator a custom equals function should be
           * provided to perform searches, the function must receive two arguments and
           * return true if they are equal, false otherwise. Example:</p>
           *
           * <pre>
           * var petsAreEqualByName = function(pet1, pet2) {
           *  return pet1.name === pet2.name;
           * }
           * </pre>
           * @param {Object} item element to search for.
           * @param {function(Object,Object):boolean=} equalsFunction Optional
           * function used to check if two elements are equal.
           * @return {boolean} true if this list contains the specified element, false
           * otherwise.
           */
        contains(item: T, equalsFunction?: IEqualsFunction<T>): boolean {
            return (this.indexOf(item, equalsFunction) >= 0);
        }

        /**
         * Removes the first occurrence of the specified element in this list.
         * <p>If the elements inside the list are
         * not comparable with the === operator a custom equals function should be
         * provided to perform searches, the function must receive two arguments and
         * return true if they are equal, false otherwise. Example:</p>
         *
         * <pre>
         * var petsAreEqualByName = function(pet1, pet2) {
         *  return pet1.name === pet2.name;
         * }
         * </pre>
         * @param {Object} item element to be removed from this list, if present.
         * @return {boolean} true if the list contained the specified element.
         */
        remove(item: T, equalsFunction?: IEqualsFunction<T>): boolean {
            var equalsF = equalsFunction || Matrix.Collections.defaultEquals;
            if (this.nElements < 1 || Matrix.Util.Functions.isUndefined(item)) {
                return false;
            }
            var previous: ILinkedListNode<T> = null;
            var currentNode: ILinkedListNode<T> = this.firstNode;

            while (currentNode !== null) {
                if (equalsF(currentNode.element, item)) {

                    if (currentNode === this.firstNode) {
                        this.firstNode = this.firstNode.next;
                        if (currentNode === this.lastNode) {
                            this.lastNode = null;
                        }
                    } else if (currentNode === this.lastNode) {
                        this.lastNode = previous;
                        previous.next = currentNode.next;
                        currentNode.next = null;
                    } else {
                        previous.next = currentNode.next;
                        currentNode.next = null;
                    }
                    this.nElements--;
                    return true;
                }
                previous = currentNode;
                currentNode = currentNode.next;
            }
            return false;
        }

        /**
         * Removes all of the elements from this list.
         */
        clear(): void {
            this.firstNode = null;
            this.lastNode = null;
            this.nElements = 0;
        }

        /**
         * Returns true if this list is equal to the given list.
         * Two lists are equal if they have the same elements in the same order.
         * @param {LinkedList} other the other list.
         * @param {function(Object,Object):boolean=} equalsFunction optional
         * function used to check if two elements are equal. If the elements in the lists
         * are custom objects you should provide a function, otherwise 
         * the === operator is used to check equality between elements.
         * @return {boolean} true if this list is equal to the given list.
         */
        equals(other: LinkedList<T>, equalsFunction?: IEqualsFunction<T>): boolean {
            var eqF = equalsFunction || Matrix.Collections.defaultEquals;
            if (!(other instanceof Matrix.Collections.LinkedList)) {
                return false;
            }
            if (this.size() !== other.size()) {
                return false;
            }
            return this.equalsAux(this.firstNode, other.firstNode, eqF);
        }

        /**
        * @private
        */
        private equalsAux(n1: ILinkedListNode<T>, n2: ILinkedListNode<T>, eqF: IEqualsFunction<T>): boolean {
            while (n1 !== null) {
                if (!eqF(n1.element, n2.element)) {
                    return false;
                }
                n1 = n1.next;
                n2 = n2.next;
            }
            return true;
        }

        /**
         * Removes the element at the specified position in this list.
         * @param {number} index given index.
         * @return {*} removed element or undefined if the index is out of bounds.
         */
        removeElementAtIndex(index: number): T {
            if (index < 0 || index >= this.nElements) {
                return undefined;
            }
            var element: T;
            if (this.nElements === 1) {
                //First node in the list.
                element = this.firstNode.element;
                this.firstNode = null;
                this.lastNode = null;
            } else {
                var previous = this.nodeAtIndex(index - 1);
                if (previous === null) {
                    element = this.firstNode.element;
                    this.firstNode = this.firstNode.next;
                } else if (previous.next === this.lastNode) {
                    element = this.lastNode.element;
                    this.lastNode = previous;
                }
                if (previous !== null) {
                    element = previous.next.element;
                    previous.next = previous.next.next;
                }
            }
            this.nElements--;
            return element;
        }

        /**
         * Executes the provided function once for each element present in this list in order.
         * @param {function(Object):*} callback function to execute, it is
         * invoked with one argument: the element value, to break the iteration you can 
         * optionally return false.
         */
        forEach(callback: (item: T) => boolean): void {
            var currentNode = this.firstNode;
            while (currentNode !== null) {
                if (callback(currentNode.element) === false) {
                    break;
                }
                currentNode = currentNode.next;
            }
        }

        /**
         * Reverses the order of the elements in this linked list (makes the last 
         * element first, and the first element last).
         */
        reverse(): void {
            var previous: ILinkedListNode<T> = null;
            var current: ILinkedListNode<T> = this.firstNode;
            var temp: ILinkedListNode<T> = null;
            while (current !== null) {
                temp = current.next;
                current.next = previous;
                previous = current;
                current = temp;
            }
            temp = this.firstNode;
            this.firstNode = this.lastNode;
            this.lastNode = temp;
        }

        /**
         * Returns an array containing all of the elements in this list in proper
         * sequence.
         * @return {Array.<*>} an array containing all of the elements in this list,
         * in proper sequence.
         */
        toArray(): T[] {
            var array: T[] = [];
            var currentNode: ILinkedListNode<T> = this.firstNode;
            while (currentNode !== null) {
                array.push(currentNode.element);
                currentNode = currentNode.next;
            }
            return array;
        }

        /**
         * Returns the number of elements in this list.
         * @return {number} the number of elements in this list.
         */
        size(): number {
            return this.nElements;
        }

        /**
         * Returns true if this list contains no elements.
         * @return {boolean} true if this list contains no elements.
         */
        isEmpty(): boolean {
            return this.nElements <= 0;
        }

        //toString(): string {
        //    return Matrix.Collections.arrays.toString(this.toArray());
        //}

        /**
         * @private
         */
        private nodeAtIndex(index: number): ILinkedListNode<T> {

            if (index < 0 || index >= this.nElements) {
                return null;
            }
            if (index === (this.nElements - 1)) {
                return this.lastNode;
            }
            var node = this.firstNode;
            for (var i = 0; i < index; i++) {
                node = node.next;
            }
            return node;
        }

        /**
         * @private
         */
        private createNode(item: T): ILinkedListNode<T> {
            return {
                element: item,
                next: null
            };
        }
    } // End of linked list 
    
    // Used internally by dictionary 
    interface IDictionaryPair<K, V> {
        key: K;
        value: V;
    }

    export class Dictionary<K, V>{

        /**
         * Object holding the key-value pairs.
         * @type {Object}
         * @private
         */
        private table: { [key: string]: IDictionaryPair<K, V> };
        //: [key: K] will not work since indices can only by strings in javascript and typescript enforces this. 

        /**
         * Number of elements in the list.
         * @type {number}
         * @private
         */
        private nElements: number;

        /**
         * Function used to convert keys to strings.
         * @type {function(Object):string}
         * @private
         */
        private toStr: (key: K) => string;


        /**
         * Creates an empty dictionary. 
         * @class <p>Dictionaries map keys to values; each key can map to at most one value.
         * This implementation accepts any kind of objects as keys.</p>
         *
         * <p>If the keys are custom objects a function which converts keys to unique
         * strings must be provided. Example:</p>
         * <pre>
         * function petToString(pet) {
         *  return pet.name;
         * }
         * </pre>
         * @constructor
         * @param {function(Object):string=} toStrFunction optional function used
         * to convert keys to strings. If the keys aren't strings or if toString()
         * is not appropriate, a custom function which receives a key and returns a
         * unique string must be provided.
         */
        constructor(toStrFunction?: (key: K) => string) {
            this.table = {};
            this.nElements = 0;
            this.toStr = toStrFunction || Matrix.Collections.defaultToString;
        }


        /**
         * Returns the value to which this dictionary maps the specified key.
         * Returns undefined if this dictionary contains no mapping for this key.
         * @param {Object} key key whose associated value is to be returned.
         * @return {*} the value to which this dictionary maps the specified key or
         * undefined if the map contains no mapping for this key.
         */
        getValue(key: K): V {
            var pair: IDictionaryPair<K, V> = this.table['$' + this.toStr(key)];
            if (Matrix.Util.Functions.isUndefined(pair)) {
                return undefined;
            }
            return pair.value;
        }


        /**
         * Associates the specified value with the specified key in this dictionary.
         * If the dictionary previously contained a mapping for this key, the old
         * value is replaced by the specified value.
         * @param {Object} key key with which the specified value is to be
         * associated.
         * @param {Object} value value to be associated with the specified key.
         * @return {*} previous value associated with the specified key, or undefined if
         * there was no mapping for the key or if the key/value are undefined.
         */
        setValue(key: K, value: V): V {

            if (Matrix.Util.Functions.isUndefined(key) || Matrix.Util.Functions.isUndefined(value)) {
                return undefined;
            }

            var ret: V;
            var k = '$' + this.toStr(key);
            var previousElement: IDictionaryPair<K, V> = this.table[k];
            if (Matrix.Util.Functions.isUndefined(previousElement)) {
                this.nElements++;
                ret = undefined;
            } else {
                ret = previousElement.value;
            }
            this.table[k] = {
                key: key,
                value: value
            };
            return ret;
        }

        /**
         * Removes the mapping for this key from this dictionary if it is present.
         * @param {Object} key key whose mapping is to be removed from the
         * dictionary.
         * @return {*} previous value associated with specified key, or undefined if
         * there was no mapping for key.
         */
        remove(key: K): V {
            var k = '$' + this.toStr(key);
            var previousElement: IDictionaryPair<K, V> = this.table[k];
            if (!Matrix.Util.Functions.isUndefined(previousElement)) {
                delete this.table[k];
                this.nElements--;
                return previousElement.value;
            }
            return undefined;
        }

        /**
         * Returns an array containing all of the keys in this dictionary.
         * @return {Array} an array containing all of the keys in this dictionary.
         */
        keys(): K[] {
            var array: K[] = [];
            for (var name in this.table) {
                if (has(this.table, name)) {
                    var pair: IDictionaryPair<K, V> = this.table[name];
                    array.push(pair.key);
                }
            }
            return array;
        }

        /**
         * Returns an array containing all of the values in this dictionary.
         * @return {Array} an array containing all of the values in this dictionary.
         */
        values(): V[] {
            var array: V[] = [];
            for (var name in this.table) {
                if (has(this.table, name)) {
                    var pair: IDictionaryPair<K, V> = this.table[name];
                    array.push(pair.value);
                }
            }
            return array;
        }

        /**
        * Executes the provided function once for each key-value pair 
        * present in this dictionary.
        * @param {function(Object,Object):*} callback function to execute, it is
        * invoked with two arguments: key and value. To break the iteration you can 
        * optionally return false.
        */
        forEach(callback: (key: K, value: V) => any): void {
            for (var name in this.table) {
                if (has(this.table, name)) {
                    var pair: IDictionaryPair<K, V> = this.table[name];
                    var ret = callback(pair.key, pair.value);
                    if (ret === false) {
                        return;
                    }
                }
            }
        }

        /**
         * Returns true if this dictionary contains a mapping for the specified key.
         * @param {Object} key key whose presence in this dictionary is to be
         * tested.
         * @return {boolean} true if this dictionary contains a mapping for the
         * specified key.
         */
        containsKey(key: K): boolean {
            return !Matrix.Util.Functions.isUndefined(this.getValue(key));
        }

        /**
        * Removes all mappings from this dictionary.
        * @this {collections.Dictionary}
        */
        clear() {

            this.table = {};
            this.nElements = 0;
        }

        /**
         * Returns the number of keys in this dictionary.
         * @return {number} the number of key-value mappings in this dictionary.
         */
        size(): number {
            return this.nElements;
        }

        /**
         * Returns true if this dictionary contains no mappings.
         * @return {boolean} true if this dictionary contains no mappings.
         */
        isEmpty(): boolean {
            return this.nElements <= 0;
        }

        toString(): string {
            var toret = "{";
            this.forEach((k, v) => {
                toret = toret + "\n\t" + k.toString() + " : " + v.toString();
            });
            return toret + "\n}";
        }
    } // End of dictionary

    // /**
    //  * Returns true if this dictionary is equal to the given dictionary.
    //  * Two dictionaries are equal if they contain the same mappings.
    //  * @param {collections.Dictionary} other the other dictionary.
    //  * @param {function(Object,Object):boolean=} valuesEqualFunction optional
    //  * function used to check if two values are equal.
    //  * @return {boolean} true if this dictionary is equal to the given dictionary.
    //  */
    // collections.Dictionary.prototype.equals = function(other,valuesEqualFunction) {
    // 	var eqF = valuesEqualFunction || collections.defaultEquals;
    // 	if(!(other instanceof collections.Dictionary)){
    // 		return false;
    // 	}
    // 	if(this.size() !== other.size()){
    // 		return false;
    // 	}
    // 	return this.equalsAux(this.firstNode,other.firstNode,eqF);
    // }
}// End of module  