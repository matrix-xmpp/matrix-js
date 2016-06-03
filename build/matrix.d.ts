/// <reference path="Typings/ltxml.d.ts" />
/// <reference path="typings/sax.d.ts" />
/*!
* Copyright (C) Alexander Gnauck, AG-Software
* Web: http://www.ag-software.de
* Email: alex@ag-software.net
*/
declare module Matrix.Collections {
    class Queue<T> {
        /**
         * List containing the elements.
         * @type collections.LinkedList
         * @private
         */
        private list;
        /**
         * Creates an empty queue.
         * @class A queue is a First-In-First-Out (FIFO) data structure, the first
         * element added to the queue will be the first one to be removed. This
         * implementation uses a linked list as a container.
         * @constructor
         */
        constructor();
        /**
         * Inserts the specified element into the end of this queue.
         * @param {Object} elem the element to insert.
         * @return {boolean} true if the element was inserted, or false if it is undefined.
         */
        enqueue(elem: T): boolean;
        /**
         * Inserts the specified element into the end of this queue.
         * @param {Object} elem the element to insert.
         * @return {boolean} true if the element was inserted, or false if it is undefined.
         */
        add(elem: T): boolean;
        /**
         * Retrieves and removes the head of this queue.
         * @return {*} the head of this queue, or undefined if this queue is empty.
         */
        dequeue(): T;
        /**
         * Retrieves, but does not remove, the head of this queue.
         * @return {*} the head of this queue, or undefined if this queue is empty.
         */
        peek(): T;
        /**
         * Returns the number of elements in this queue.
         * @return {number} the number of elements in this queue.
         */
        size(): number;
        /**
         * Returns true if this queue contains the specified element.
         * <p>If the elements inside this stack are
         * not comparable with the === operator, a custom equals function should be
         * provided to perform searches, the function must receive two arguments and
         * return true if they are equal, false otherwise. Example:</p>
         *
         * <pre>
         * var petsAreEqualByName (pet1, pet2) {
         *  return pet1.name === pet2.name;
         * }
         * </pre>
         * @param {Object} elem element to search for.
         * @param {function(Object,Object):boolean=} equalsFunction optional
         * function to check if two elements are equal.
         * @return {boolean} true if this queue contains the specified element,
         * false otherwise.
         */
        contains(elem: T, equalsFunction?: IEqualsFunction<T>): boolean;
        /**
         * Checks if this queue is empty.
         * @return {boolean} true if and only if this queue contains no items; false
         * otherwise.
         */
        isEmpty(): boolean;
        /**
         * Removes all of the elements from this queue.
         */
        clear(): void;
        /**
         * Executes the provided function once for each element present in this queue in
         * FIFO order.
         * @param {function(Object):*} callback function to execute, it is
         * invoked with one argument: the element value, to break the iteration you can
         * optionally return false.
         */
        forEach(callback: ILoopFunction<T>): void;
    }
}
declare module Matrix.Util.Functions {
    /**
     * Checks if the given argument is a function.
     * @function
     */
    function isFunction(func: any): boolean;
    /**
     * Checks if the given argument is undefined.
     * @function
     */
    function isUndefined(obj: any): boolean;
    /**
     * Checks if the given argument is a string.
     * @function
     */
    function isString(obj: any): boolean;
    function textFormat(source: string, ...args: any[]): string;
    function hexToString(byteArray: Array<number>): string;
}
/**
 * @namespace Top level namespace for collections, a TypeScript data structure library.
 */
declare module Matrix.Collections {
    /**
    * Function signature for comparing
    * <0 means a is smaller
    * = 0 means they are equal
    * >0 means a is larger
    */
    interface ICompareFunction<T> {
        (a: T, b: T): number;
    }
    /**
    * Function signature for checking equality
    */
    interface IEqualsFunction<T> {
        (a: T, b: T): boolean;
    }
    /**
    * Function signature for Iterations. Return false to break from loop
    */
    interface ILoopFunction<T> {
        (a: T): boolean;
    }
    /**
     * Default function to compare element order.
     * @function
     */
    function defaultCompare<T>(a: T, b: T): number;
    /**
     * Default function to test equality.
     * @function
     */
    function defaultEquals<T>(a: T, b: T): boolean;
    /**
     * Default function to convert an object to a string.
     * @function
     */
    function defaultToString(item: any): string;
    /**
    * Joins all the properies of the object using the provided join string
    */
    function makeString<T>(item: T, join?: string): string;
    /**
     * Reverses a compare function.
     * @function
     */
    function reverseCompareFunction<T>(compareFunction: ICompareFunction<T>): ICompareFunction<T>;
    /**
     * Returns an equal function given a compare function.
     * @function
     */
    function compareToEquals<T>(compareFunction: ICompareFunction<T>): IEqualsFunction<T>;
    /**
     * @namespace Contains various functions for manipulating arrays.
     */
    interface ILinkedListNode<T> {
        element: T;
        next: ILinkedListNode<T>;
    }
    class LinkedList<T> {
        /**
        * First node in the list
        * @type {Object}
        * @private
        */
        firstNode: ILinkedListNode<T>;
        /**
        * Last node in the list
        * @type {Object}
        * @private
        */
        private lastNode;
        /**
        * Number of elements in the list
        * @type {number}
        * @private
        */
        private nElements;
        /**
        * Creates an empty Linked List.
        * @class A linked list is a data structure consisting of a group of nodes
        * which together represent a sequence.
        * @constructor
        */
        constructor();
        /**
        * Adds an element to this list.
        * @param {Object} item element to be added.
        * @param {number=} index optional index to add the element. If no index is specified
        * the element is added to the end of this list.
        * @return {boolean} true if the element was added or false if the index is invalid
        * or if the element is undefined.
        */
        add(item: T, index?: number): boolean;
        /**
        * Returns the first element in this list.
        * @return {*} the first element of the list or undefined if the list is
        * empty.
        */
        first(): T;
        /**
        * Returns the last element in this list.
        * @return {*} the last element in the list or undefined if the list is
        * empty.
        */
        last(): T;
        /**
         * Returns the element at the specified position in this list.
         * @param {number} index desired index.
         * @return {*} the element at the given index or undefined if the index is
         * out of bounds.
         */
        elementAtIndex(index: number): T;
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
        indexOf(item: T, equalsFunction?: IEqualsFunction<T>): number;
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
        contains(item: T, equalsFunction?: IEqualsFunction<T>): boolean;
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
        remove(item: T, equalsFunction?: IEqualsFunction<T>): boolean;
        /**
         * Removes all of the elements from this list.
         */
        clear(): void;
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
        equals(other: LinkedList<T>, equalsFunction?: IEqualsFunction<T>): boolean;
        /**
        * @private
        */
        private equalsAux(n1, n2, eqF);
        /**
         * Removes the element at the specified position in this list.
         * @param {number} index given index.
         * @return {*} removed element or undefined if the index is out of bounds.
         */
        removeElementAtIndex(index: number): T;
        /**
         * Executes the provided function once for each element present in this list in order.
         * @param {function(Object):*} callback function to execute, it is
         * invoked with one argument: the element value, to break the iteration you can
         * optionally return false.
         */
        forEach(callback: (item: T) => boolean): void;
        /**
         * Reverses the order of the elements in this linked list (makes the last
         * element first, and the first element last).
         */
        reverse(): void;
        /**
         * Returns an array containing all of the elements in this list in proper
         * sequence.
         * @return {Array.<*>} an array containing all of the elements in this list,
         * in proper sequence.
         */
        toArray(): T[];
        /**
         * Returns the number of elements in this list.
         * @return {number} the number of elements in this list.
         */
        size(): number;
        /**
         * Returns true if this list contains no elements.
         * @return {boolean} true if this list contains no elements.
         */
        isEmpty(): boolean;
        /**
         * @private
         */
        private nodeAtIndex(index);
        /**
         * @private
         */
        private createNode(item);
    }
    class Dictionary<K, V> {
        /**
         * Object holding the key-value pairs.
         * @type {Object}
         * @private
         */
        private table;
        /**
         * Number of elements in the list.
         * @type {number}
         * @private
         */
        private nElements;
        /**
         * Function used to convert keys to strings.
         * @type {function(Object):string}
         * @private
         */
        private toStr;
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
        constructor(toStrFunction?: (key: K) => string);
        /**
         * Returns the value to which this dictionary maps the specified key.
         * Returns undefined if this dictionary contains no mapping for this key.
         * @param {Object} key key whose associated value is to be returned.
         * @return {*} the value to which this dictionary maps the specified key or
         * undefined if the map contains no mapping for this key.
         */
        getValue(key: K): V;
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
        setValue(key: K, value: V): V;
        /**
         * Removes the mapping for this key from this dictionary if it is present.
         * @param {Object} key key whose mapping is to be removed from the
         * dictionary.
         * @return {*} previous value associated with specified key, or undefined if
         * there was no mapping for key.
         */
        remove(key: K): V;
        /**
         * Returns an array containing all of the keys in this dictionary.
         * @return {Array} an array containing all of the keys in this dictionary.
         */
        keys(): K[];
        /**
         * Returns an array containing all of the values in this dictionary.
         * @return {Array} an array containing all of the values in this dictionary.
         */
        values(): V[];
        /**
        * Executes the provided function once for each key-value pair
        * present in this dictionary.
        * @param {function(Object,Object):*} callback function to execute, it is
        * invoked with two arguments: key and value. To break the iteration you can
        * optionally return false.
        */
        forEach(callback: (key: K, value: V) => any): void;
        /**
         * Returns true if this dictionary contains a mapping for the specified key.
         * @param {Object} key key whose presence in this dictionary is to be
         * tested.
         * @return {boolean} true if this dictionary contains a mapping for the
         * specified key.
         */
        containsKey(key: K): boolean;
        /**
        * Removes all mappings from this dictionary.
        * @this {collections.Dictionary}
        */
        clear(): void;
        /**
         * Returns the number of keys in this dictionary.
         * @return {number} the number of key-value mappings in this dictionary.
         */
        size(): number;
        /**
         * Returns true if this dictionary contains no mappings.
         * @return {boolean} true if this dictionary contains no mappings.
         */
        isEmpty(): boolean;
        toString(): string;
    }
}
declare module Matrix.Collections {
    class Stack<T> {
        /**
         * List containing the elements.
         * @type collections.LinkedList
         * @private
         */
        private list;
        /**
         * Creates an empty Stack.
         * @class A Stack is a Last-In-First-Out (LIFO) data structure, the last
         * element added to the stack will be the first one to be removed. This
         * implementation uses a linked list as a container.
         * @constructor
         */
        constructor();
        /**
         * Pushes an item onto the top of this stack.
         * @param {Object} elem the element to be pushed onto this stack.
         * @return {boolean} true if the element was pushed or false if it is undefined.
         */
        push(elem: T): boolean;
        /**
         * Pushes an item onto the top of this stack.
         * @param {Object} elem the element to be pushed onto this stack.
         * @return {boolean} true if the element was pushed or false if it is undefined.
         */
        add(elem: T): boolean;
        /**
         * Removes the object at the top of this stack and returns that object.
         * @return {*} the object at the top of this stack or undefined if the
         * stack is empty.
         */
        pop(): T;
        /**
         * Looks at the object at the top of this stack without removing it from the
         * stack.
         * @return {*} the object at the top of this stack or undefined if the
         * stack is empty.
         */
        peek(): T;
        /**
         * Returns the number of elements in this stack.
         * @return {number} the number of elements in this stack.
         */
        size(): number;
        /**
         * Returns true if this stack contains the specified element.
         * <p>If the elements inside this stack are
         * not comparable with the === operator, a custom equals function should be
         * provided to perform searches, the function must receive two arguments and
         * return true if they are equal, false otherwise. Example:</p>
         *
         * <pre>
         * var petsAreEqualByName (pet1, pet2) {
         *  return pet1.name === pet2.name;
         * }
         * </pre>
         * @param {Object} elem element to search for.
         * @param {function(Object,Object):boolean=} equalsFunction optional
         * function to check if two elements are equal.
         * @return {boolean} true if this stack contains the specified element,
         * false otherwise.
         */
        contains(elem: T, equalsFunction?: IEqualsFunction<T>): boolean;
        /**
         * Checks if this stack is empty.
         * @return {boolean} true if and only if this stack contains no items; false
         * otherwise.
         */
        isEmpty(): boolean;
        /**
         * Removes all of the elements from this stack.
         */
        clear(): void;
        /**
         * Executes the provided function once for each element present in this stack in
         * LIFO order.
         * @param {function(Object):*} callback function to execute, it is
         * invoked with one argument: the element value, to break the iteration you can
         * optionally return false.
         */
        forEach(callback: ILoopFunction<T>): void;
    }
}
interface IEvent<T> {
    on(handler: {
        (data?: T): void;
    }): any;
    off(handler: {
        (data?: T): void;
    }): any;
}
declare module Matrix {
    class EventArgs {
        private _state;
        state: any;
    }
}
declare module Matrix {
    class Jid {
        _node: string;
        _domain: string;
        _resource: string;
        constructor(jid: string);
        node: string;
        domain: string;
        resource: string;
        bare: string;
        full: string;
        toString(): string;
        getBare(): string;
        getFull(): string;
        getBareJidFromJid(jid: string): string;
        getResourceFromJid(jid: string): string;
        getDomainFromJid(jid: string): string;
        getNodeFromJid(jid: string): string;
        clone(): Jid;
    }
}
declare module Matrix {
    class JidEventArgs extends EventArgs {
        private _jid;
        constructor(jid: Jid);
        jid: Jid;
    }
}
declare module Matrix.Net {
    class WebRequestEventArgs extends EventArgs {
        private _tag;
        private _data;
        constructor(data: string, tag: string);
        tag: string;
        data: string;
    }
}
declare module Matrix.Crypt {
    class RandomNumberGenerator {
        static create(): RandomNumberGenerator;
        getBytes(array: Array<number>): void;
        getString(length: number): string;
        getNumber(min: number, max: number): number;
    }
}
declare module Matrix.Util.Enum {
    function toString(e: any, eVal: any): string;
    function parse(e: any, val: string): any;
}
declare module Matrix.Util.Time {
    function Iso8601Date(date: string): number;
}
declare module Matrix.Xml {
    import XElement = Ltxml.XElement;
    class XmppXElement extends XElement {
        constructor(ns: string, tagname: string, prefix?: string);
        toString(indent?: boolean): string;
        startTag(): string;
        endTag(): string;
        getAttribute(attname: string): string;
        hasAttribute(attname: string): boolean;
        setAttribute(attname: string, val: string): XmppXElement;
        removeAttribute(attname: string): XmppXElement;
        setAttributeEnum(attname: string, e: any, eVal: any): XmppXElement;
        getAttributeEnum(attname: string, e: any): any;
        getAttributeBoolean(name: string): boolean;
        setAttributeBoolean(name: string, val: boolean): XmppXElement;
        getAttributeNumber(name: any): number;
        setAttributeNumber(attname: string, val: number): XmppXElement;
        setAttributeIso8601Date(attname: string, val: number): XmppXElement;
        getAttributeIso8601Date(attname: string): number;
        getAttributeJid(attname: string): Jid;
        setAttributeJid(attname: string, jid: Jid): XmppXElement;
        getFirstXmppXElement(): XmppXElement;
        firstXmppXElement: XmppXElement;
        elementOfType<T extends Ltxml.XElement>(typee: {
            new (): T;
        }): T;
        elementsOfType<T extends Ltxml.XElement>(typee: {
            new (): T;
        }): linqjs.Enumerable;
        getValueFromBase64(): string;
        setValueFromBase64(value: string): void;
        getTag(tagname: string): string;
        hasElementOfType<T extends XmppXElement>(typee: {
            new (): T;
        }): boolean;
        hasTag(tagname: string): boolean;
        getTagJid(tagname: string): Jid;
        removeTag(tagname: string): void;
        setTag(tagname: string, value: string): XmppXElement;
        replace<T extends XmppXElement>(clazz: {
            new (): T;
        }, value: T): void;
        static loadXml(xml: string): XmppXElement;
    }
}
declare module Matrix {
    class ExceptionEventArgs extends EventArgs {
        _exception: string;
        constructor(ex: string);
        exception: string;
    }
}
declare module Matrix {
    class TextEventArgs extends EventArgs {
        constructor(text: string);
        _text: string;
        text: string;
    }
}
declare module Matrix.Net {
    import XmppXElement = Matrix.Xml.XmppXElement;
    interface ISocket {
        send(el: XmppXElement | string): any;
        connect(): void;
        disconnect(): void;
        onConnect: GenericEvent<EventArgs>;
        onDisconnect: GenericEvent<EventArgs>;
        onReadData: GenericEvent<TextEventArgs>;
        onWriteData: GenericEvent<TextEventArgs>;
        onError: GenericEvent<ExceptionEventArgs>;
    }
}
declare module Matrix.Xmpp.Bosh {
    var conditionMapping: string[];
    enum Condition {
        None = -1,
        BadRequest = 0,
        HostGone = 1,
        HostUnknown = 2,
        ImproperAddressing = 3,
        InternalServerError = 4,
        ItemNotFound = 5,
        OtherRequest = 6,
        PolicyViolation = 7,
        RemoteConnectionFailed = 8,
        RemoteStreamError = 9,
        SeeOtherUri = 10,
        SystemShutdown = 11,
        UndefinedCondition = 12,
    }
    function conditionToEnum(val: string): Condition;
    function enumToCondition(cond: Condition): string;
}
declare module Matrix.Xmpp.Bosh {
    enum Type {
        None = -1,
        Error = 0,
        Terminate = 1,
    }
}
declare module Matrix.Xmpp.Base {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class XmppXElementWithAddress extends XmppXElement {
        constructor(ns: string, tagname: string, prefix?: string);
        from: Jid;
        to: Jid;
        switchDirection(): void;
    }
}
declare module Matrix {
    module Namespaces {
        var stream: string;
        var client: string;
        var server: string;
        var serverDialback: string;
        var featureIqRegister: string;
        var sasl: string;
        var bind: string;
        var session: string;
        var iqRoster: string;
        var httpBind: string;
        var xmppXBosh: string;
        var framing: string;
        var delay: string;
        var muc: string;
        var mucUser: string;
        var mucAdmin: string;
        var mucOwner: string;
        var xConference: string;
    }
}
declare module Matrix.Xmpp.Bosh {
    import XmppXElementWithAddress = Matrix.Xmpp.Base.XmppXElementWithAddress;
    class Body extends XmppXElementWithAddress {
        private nsBosh;
        constructor();
        version: string;
        polling: number;
        rid: number;
        sid: string;
        hold: number;
        wait: number;
        inactivity: number;
        xmppVersion: string;
        xmppRestart: boolean;
        type: Type;
        condition: Condition;
        addBoshNameSpace(): Body;
        addStreamNameSpace(): Body;
    }
}
declare module Matrix {
    class GenericEvent<T> implements IEvent<T> {
        private handlers;
        on(handler: {
            (data?: T): void;
        }): void;
        off(handler: {
            (data?: T): void;
        }): void;
        trigger(data?: T): void;
    }
}
declare module Matrix.Util {
    class Timer {
        onTick: GenericEvent<void>;
        _timerToken: number;
        _interval: number;
        constructor(interval?: number);
        interval: number;
        start(): void;
        stop(): void;
    }
}
declare module Matrix.Net {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class BoshSocket implements ISocket {
        DEFAULT_WAIT: number;
        DEFAULT_SEND_FUNC_INTERVAL: number;
        DEFAULT_RECONNECT_INTERVALS: number[];
        constructor(xmppClient: XmppClient);
        onReadData: GenericEvent<TextEventArgs>;
        onWriteData: GenericEvent<TextEventArgs>;
        onConnect: GenericEvent<EventArgs>;
        onDisconnect: GenericEvent<EventArgs>;
        onError: GenericEvent<ExceptionEventArgs>;
        private _xmppClient;
        private requestA;
        private requestB;
        private maxRidToGenerate;
        private maxRidAllowed;
        private BOSH_VERSION;
        private sid;
        private rid;
        private wait;
        private inactivity;
        private terminate;
        private clientTerminated;
        private serverTerminated;
        private sessionStarted;
        private deadTime;
        private sendQueue;
        private sendFuncInterval;
        private reconnectIntervalsIndex;
        connect(): void;
        disconnect(): void;
        send(el: XmppXElement | string): void;
        private readDataHandler;
        private readDataHandlerFunc(args);
        private sendDataHandler;
        private sendDataHandlerFunc(args);
        private errorHandler;
        private errorHandlerFunc(args);
        private processBody(body);
        private bothBusy;
        private noneBusy;
        private oneBusy;
        private countBusy;
        private getNextHttpWebRequest();
        private generateRid();
        private buildSessionRequestBody();
        private buildBody();
        private cancelRequests();
        sendFunction(): void;
        private triggerSendFunction();
    }
}
declare module Matrix.Net {
    class WebRequest {
        webRequest: XMLHttpRequest;
        tag: string;
        url: string;
        data: string;
        isBusy: boolean;
        onReadData: GenericEvent<WebRequestEventArgs>;
        onSendData: GenericEvent<WebRequestEventArgs>;
        onError: GenericEvent<ExceptionEventArgs>;
        constructor(url: string, tag: string);
        private create();
        private requestOnreadyStateChange(webRequest);
        execute(data: string): void;
        cancel(): void;
    }
}
declare module Matrix.Sasl {
    var saslMechanismMapping: string[];
    enum SaslMechanism {
        None = -1,
        Plain = 0,
        DigestMd5 = 1,
        ScramSha1 = 2,
        Anonymous = 3,
    }
    var saslMechanismPriorities: number[];
    function saslMechanismNameToEnum(val: string): SaslMechanism;
    function enumToSaslMechanismName(mech: Matrix.Sasl.SaslMechanism): string;
}
declare module Matrix.Xmpp.Base {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Sasl extends XmppXElement {
        constructor(tag: string);
    }
}
declare module Matrix.Xmpp.Sasl {
    import SaslMechanism = Matrix.Sasl.SaslMechanism;
    class Auth extends Base.Sasl {
        constructor(saslMechanism?: SaslMechanism, value?: string);
        saslMechanism: SaslMechanism;
    }
}
declare module Matrix.Sasl {
    import Challenge = Matrix.Xmpp.Sasl.Challenge;
    class SaslProcessor {
        private _xmppClient;
        private _server;
        private _username;
        private _password;
        xmppClient: XmppClient;
        server: string;
        username: string;
        password: string;
        init(xmppClient: XmppClient): void;
        parse(ch: Challenge): void;
    }
}
declare module Matrix.Sasl {
    class AnonymousProcessor extends SaslProcessor {
        init(xmppClient: XmppClient): void;
    }
}
declare module Matrix {
    enum Transport {
        Websocket = 0,
        Bosh = 1,
    }
}
declare module Matrix.Xmpp.Base {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class XmppXElementWithJidAttribute extends XmppXElement {
        constructor(ns: string, tagname: string);
        jid: Jid;
    }
}
declare module Matrix.Xmpp.Base {
    class Item extends XmppXElementWithJidAttribute {
        constructor(ns: string);
        nickname: string;
    }
}
declare module Matrix.Xmpp.Roster {
    enum Ask {
        None = -1,
        Subscribe = 0,
        Unsubscribe = 1,
    }
}
declare module Matrix.Xmpp.Roster {
    enum Subscription {
        None = 0,
        To = 1,
        From = 2,
        Both = 3,
        Remove = 4,
    }
}
declare module Matrix.Xmpp.Base {
    class RosterItem extends Item {
        constructor(ns: string);
    }
}
declare module Matrix {
    class Id {
        static _prefix: string;
        static _counter: number;
        static getNextId(): string;
    }
}
declare module Matrix.Xmpp.Base {
    class XmppXElementWithAddressAndId extends XmppXElementWithAddress {
        constructor(ns: string, tagname: string, prefix?: string);
        id: string;
        generateId(): void;
    }
}
declare module Matrix.Xmpp.Base {
    class XmppXElementWithAddressAndIdAndVersion extends XmppXElementWithAddressAndId {
        constructor(ns: string, tagname: string, prefix?: string);
        version: string;
    }
}
declare module Matrix.Xmpp.Bind {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Bind extends XmppXElement {
        constructor();
        resource: string;
        jid: Jid;
    }
}
declare module Matrix.Xmpp {
    enum IqType {
        Get = 0,
        Set = 1,
        Result = 2,
        Error = 3,
    }
}
declare module Matrix.Xmpp.Base {
    class Iq extends XmppXElementWithAddressAndId {
        constructor(ns: string);
        type: IqType;
    }
}
declare module Matrix.Xmpp.Client {
    class Iq extends Base.Iq {
        constructor();
    }
}
declare module Matrix.Xmpp.Client {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class IqQuery<T extends XmppXElement> extends Iq {
        private _query;
        constructor(query: {
            new (): T;
        });
        query: T;
    }
}
declare module Matrix.Xmpp.Delay {
    import XmppXElementWithAddress = Matrix.Xmpp.Base.XmppXElementWithAddress;
    class Delay extends XmppXElementWithAddress {
        constructor();
        stamp: number;
    }
}
declare module Matrix.Xmpp.Framing {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Close extends XmppXElement {
        constructor();
    }
}
declare module Matrix.Xmpp.Framing {
    import XmppXElementWithAddressAndIdAndVersion = Matrix.Xmpp.Base.XmppXElementWithAddressAndIdAndVersion;
    class Open extends XmppXElementWithAddressAndIdAndVersion {
        constructor();
    }
}
declare module Matrix.Xmpp.Muc {
    enum Affiliation {
        None = 0,
        Owner = 1,
        Admin = 2,
        Member = 3,
        Outcast = 4,
    }
}
declare module Matrix.Xmpp.Muc {
    import XmppXElementWithJidAttribute = Base.XmppXElementWithJidAttribute;
    class Conference extends XmppXElementWithJidAttribute {
        constructor();
        password: string;
        reason: string;
    }
}
declare module Matrix.Xmpp.Muc {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class History extends XmppXElement {
        constructor();
        seconds: number;
        maxStanzas: number;
        since: number;
        maxCharacters: number;
    }
}
declare module Matrix.Xmpp.Muc {
    class Item extends Base.Item {
        constructor(ns: string);
        role: Role;
        type: Role;
        affiliation: Affiliation;
        nick: string;
        reason: string;
    }
}
declare module Matrix.Xmpp.Muc {
    enum Role {
        None = 0,
        Moderator = 1,
        Participant = 2,
        Visitor = 3,
    }
}
declare module Matrix.Xmpp.Muc.User {
    import XmppXElementWithJidAttribute = Matrix.Xmpp.Base.XmppXElementWithJidAttribute;
    class Actor extends XmppXElementWithJidAttribute {
        constructor();
        nick: string;
    }
}
declare module Matrix.Xmpp.Muc.User {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Continue extends XmppXElement {
        constructor();
        thread: string;
    }
}
declare module Matrix.Xmpp.Muc.User {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Status extends XmppXElement {
        constructor();
        codeInt: number;
        statusCode: StatusCode;
    }
}
declare module Matrix.Xmpp.Muc.User {
    enum StatusCode {
        Unknown = -1,
        FullJidVisible = 100,
        AffiliationChanged = 101,
        ShowUnavailableMembers = 102,
        HideUnavailableMembers = 103,
        ConfigurationChanged = 104,
        SelfPresence = 110,
        LoggingEnabled = 170,
        LoggingDisabled = 171,
        RoomNonAnonymous = 172,
        RoomSemiAnonymous = 173,
        RoomAnonymous = 174,
        RoomCreated = 201,
        ModifiedNick = 210,
        Banned = 301,
        NewNickname = 303,
        Kicked = 307,
        AffiliationChange = 321,
        MembersOnly = 322,
        Shutdown = 332,
    }
}
declare module Matrix.Xmpp.Muc {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class X extends XmppXElement {
        constructor();
        password: string;
        history: History;
    }
}
declare module Matrix.Xmpp {
    enum PresenceType {
        Available = -1,
        Subscribe = 0,
        Subscribed = 1,
        Unsubscribe = 2,
        Unsubscribed = 3,
        Unavailable = 4,
        Invisible = 5,
        Visible = 6,
        Error = 7,
        Probe = 8,
    }
}
declare module Matrix.Xmpp.Roster {
    class RosterItem extends Matrix.Xmpp.Base.RosterItem {
        constructor();
        subscription: Subscription;
        ask: Ask;
        approved: boolean;
    }
}
declare module Matrix.Xmpp.Roster {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Roster extends XmppXElement {
        constructor();
        getRoster(): linqjs.Enumerable;
        version: string;
    }
}
declare module Matrix.Xmpp.Roster {
    class RosterEventArgs extends EventArgs {
        constructor(rosterItem: RosterItem, version?: string);
        private _rosterItem;
        private _version;
        rosterItem: RosterItem;
        version: string;
    }
}
declare module Matrix.Xmpp.Session {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Session extends XmppXElement {
        constructor();
    }
}
declare module Matrix.Xmpp {
    var showMapping: string[];
    enum Show {
        None = -1,
        Away = 0,
        Chat = 1,
        DoNotDisturb = 2,
        ExtendedAway = 3,
    }
    function showNameToEnum(val: string): Show;
    function enumToShowName(show: Show): string;
}
declare module Matrix {
    import Iq = Matrix.Xmpp.Client.Iq;
    class IqEventArgs extends EventArgs {
        private _iq;
        constructor(iq: Iq);
        iq: Iq;
    }
}
declare module Matrix {
    class FilterData {
        private _id;
        private _state;
        private _iqCallback;
        constructor(iqCallback?: {
            (data: IqEventArgs): void;
        }, state?: any);
        id: string;
        state: any;
        iqCallback: {
            (data: IqEventArgs): void;
        };
    }
}
declare module Matrix.Xmpp.Sasl {
    import SaslMechanism = Matrix.Sasl.SaslMechanism;
    import SaslProcessor = Matrix.Sasl.SaslProcessor;
    class SaslEventArgs extends EventArgs {
        _auto: boolean;
        _mechanisms: Mechanisms;
        _saslMechanism: SaslMechanism;
        _customSaslProcessor: SaslProcessor;
        _failure: Failure;
        constructor(failure?: Failure);
        auto: boolean;
        mechanisms: Mechanisms;
        saslMechanism: SaslMechanism;
        customSaslProcessor: SaslProcessor;
        failure: Failure;
    }
}
declare module Matrix.Xmpp.Base {
    class Presence extends XmppXElementWithAddressAndId {
        constructor(ns: string);
        type: PresenceType;
        show: Show;
        priority: number;
        status: string;
    }
}
declare module Matrix.Xmpp.Client {
    class Presence extends Base.Presence {
        constructor();
    }
}
declare module Matrix.Util.Base64 {
    /**
         * Encodes a string in base64
         * @param {String} input The string to encode in base64.
         */
    function encode(input: string): string;
    /**
         * Decodes a base64 string.
         * @param {String} input The string to decode.
         */
    function decode(input: string): string;
}
declare module Matrix.Net {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class WebSocketEx implements ISocket {
        onReadData: GenericEvent<TextEventArgs>;
        onWriteData: GenericEvent<TextEventArgs>;
        onConnect: GenericEvent<EventArgs>;
        onDisconnect: GenericEvent<EventArgs>;
        onError: GenericEvent<ExceptionEventArgs>;
        private _xmppClient;
        private webSocket;
        constructor(xmppClient: XmppClient);
        connect(): void;
        disconnect(): void;
        send(data: XmppXElement | string): void;
    }
}
declare module Matrix {
    import XmppXElement = Matrix.Xml.XmppXElement;
    import SaslEventArgs = Matrix.Xmpp.Sasl.SaslEventArgs;
    import RosterEventArgs = Matrix.Xmpp.Roster.RosterEventArgs;
    import Show = Matrix.Xmpp.Show;
    class XmppClient {
        onReadXml: GenericEvent<TextEventArgs>;
        onWriteXml: GenericEvent<TextEventArgs>;
        onStreamFeatures: GenericEvent<StanzaEventArgs>;
        onIq: GenericEvent<IqEventArgs>;
        onPresence: GenericEvent<PresenceEventArgs>;
        onMessage: GenericEvent<MessageEventArgs>;
        onBind: GenericEvent<JidEventArgs>;
        onBindStart: GenericEvent<IqEventArgs>;
        onBindError: GenericEvent<IqEventArgs>;
        onLogin: GenericEvent<EventArgs>;
        onClose: GenericEvent<EventArgs>;
        onSessionReady: GenericEvent<EventArgs>;
        onRosterStart: GenericEvent<EventArgs>;
        onRosterItem: GenericEvent<RosterEventArgs>;
        onRosterEnd: GenericEvent<EventArgs>;
        onSaslStart: GenericEvent<SaslEventArgs>;
        onError: GenericEvent<ExceptionEventArgs>;
        private _socket;
        private _xmppDomain;
        private _username;
        private _password;
        private _resource;
        private _port;
        private _autoRoster;
        private _autoPresence;
        private _receivedOwnPresence;
        private _priority;
        private _show;
        private _status;
        private _uri;
        private _transport;
        private _myJid;
        private _xmppStreamParser;
        private _streamFeatureHelper;
        private _saslHandler;
        private _iqFilter;
        constructor(username?: string, password?: string, xmppDomain?: string);
        private initSocket();
        xmppDomain: string;
        username: string;
        password: string;
        resource: string;
        port: number;
        xmppStreamParser: Matrix.Xml.XmppStreamParser;
        iqFilter: IqFilter;
        autoRoster: boolean;
        autoPresence: boolean;
        priority: number;
        show: Show;
        status: string;
        uri: string;
        transport: Transport;
        open(): void;
        close(): void;
        send(xml: XmppXElement | string): void;
        private initStreamParser();
        private initSaslHandler();
        private streamReset();
        private sendStreamHeader();
        private sendStreamFooter();
        private processIq(iq);
        private processRosterIq(iq);
        private processStreamFeatures(features);
        private bindResource();
        private bindResult;
        requestRoster(version?: string): void;
        private requestSession();
        private requestSessionResult;
        private sendInitialPresence();
        sendPresence(show?: Show, status?: string, priority?: number): void;
    }
}
declare module Matrix {
    import Dictionary = Matrix.Collections.Dictionary;
    import Iq = Matrix.Xmpp.Client.Iq;
    class IqFilter {
        _dictFilter: Dictionary<string, FilterData>;
        _xmppClient: XmppClient;
        constructor(xmppClient: XmppClient);
        sendIq(iq: Iq, callback: {
            (data: IqEventArgs): void;
        }, state?: any): void;
        private iqHandler;
    }
}
declare module Matrix.Xmpp {
    enum MessageType {
        Normal = -1,
        Error = 0,
        Chat = 1,
        GroupChat = 2,
        Headline = 3,
    }
}
declare module Matrix.Xmpp.Base {
    class Message extends XmppXElementWithAddressAndId {
        constructor(ns: string);
        type: MessageType;
        body: string;
        subject: string;
        delay: Delay.Delay;
    }
}
declare module Matrix.Xmpp.Client {
    class Message extends Base.Message {
        constructor();
    }
}
declare module Matrix {
    import Message = Matrix.Xmpp.Client.Message;
    class MessageEventArgs extends EventArgs {
        private _message;
        constructor(message: Message);
        message: Message;
    }
}
declare module Matrix {
    import Presence = Matrix.Xmpp.Client.Presence;
    class PresenceEventArgs extends EventArgs {
        private _presence;
        constructor(presence: Presence);
        presence: Presence;
    }
}
declare module Matrix.Xmpp.Sasl {
    import XmppXElement = Matrix.Xml.XmppXElement;
    import SaslMechanism = Matrix.Sasl.SaslMechanism;
    class Mechanism extends XmppXElement {
        constructor();
        saslMechanism: SaslMechanism;
    }
}
declare module Matrix.Sasl {
    class PlainProcessor extends SaslProcessor {
        init(xmppClient: XmppClient): void;
        private getMessage();
    }
}
declare module Matrix.Sasl.Digest {
    class Step2 {
        private _Cnonce;
        private _Nc;
        private _DigestUri;
        private _Response;
        private _Authzid;
        cnonce: string;
        nc: string;
        digestUri: string;
        response: string;
        authzid: string;
        private _step1;
        private _proc;
        constructor(step1: Step1, proc: SaslProcessor);
        getMessage(): string;
        private generateCnonce();
        private generateNc();
        private generateDigestUri();
        private generateResponse();
        private generateMessage();
        private addQuotes(s);
    }
}
declare module Matrix.Sasl.Digest {
    class Step1 {
        private _Realm;
        private _Nonce;
        private _Qop;
        private _Charset;
        private _Algorithm;
        private _Rspauth;
        realm: string;
        nonce: string;
        qop: string;
        charset: string;
        algorithm: string;
        rspauth: string;
        constructor(s: string);
        parse(message: string): void;
        parsePair(pair: string): void;
    }
}
declare module Matrix.Xmpp.Sasl {
    class Challenge extends Base.Sasl {
        constructor();
    }
}
declare module Matrix.Xmpp.Sasl {
    class Response extends Base.Sasl {
        constructor(value?: string);
    }
}
declare module Matrix.Sasl {
    import Challenge = Matrix.Xmpp.Sasl.Challenge;
    class DigestMD5Processor extends SaslProcessor {
        init(xmppClient: XmppClient): void;
        parse(ch: Challenge): void;
    }
}
declare module Matrix.Crypt.SHA1 {
    function core_hmac_sha1(key: any, data: any): number[];
    function binb2str(bin: any): string;
    function b64_hmac_sha1(key: any, data: any): string;
    function b64_sha1(s: any): string;
    function str_hmac_sha1(key: any, data: any): string;
    function str_sha1(s: any): string;
}
declare module Matrix.Sasl.Scram {
    import Dictionary = Collections.Dictionary;
    class ScramHelper {
        private LENGHT_CLIENT_NONCE;
        private LENGHT_SERVER_NONCE;
        private LENGHT_SALT;
        private DEFAULT_ITERATION_COUNT;
        private firstClientMessage;
        string: any;
        private firstServerMessage;
        private clientNonceB64;
        private serverNonceB64;
        generateSalt(): string;
        generateClientNonce(): string;
        generateServerNonce(): string;
        parseMessage(msg: string): Dictionary<string, string>;
        hi(pass: string, salt: string, iterations: number): string;
        generateFirstClientMessage(user: string): string;
        generateFinalClientMessage(sMessage: string, password: string): string;
        private binaryXor(b1, b2);
        escapeUsername(user: string): string;
    }
}
declare module Matrix.Sasl {
    import Challenge = Matrix.Xmpp.Sasl.Challenge;
    class ScramProcessor extends SaslProcessor {
        private scramHelper;
        init(xmppClient: XmppClient): void;
        parse(ch: Challenge): void;
    }
}
declare module Matrix.Sasl.SaslFactory {
    function create(mech: SaslMechanism): SaslProcessor;
}
declare module Matrix.Xmpp.Sasl {
    class Success extends Base.Sasl {
        constructor();
    }
}
declare module Matrix.Xmpp.Sasl {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Failure extends XmppXElement {
        constructor();
    }
}
declare module Matrix {
    import SaslProcessor = Matrix.Sasl.SaslProcessor;
    import SaslEventArgs = Matrix.Xmpp.Sasl.SaslEventArgs;
    class SaslHandler {
        onSaslStart: GenericEvent<SaslEventArgs>;
        onSaslSuccess: GenericEvent<EventArgs>;
        onSaslFailure: GenericEvent<SaslEventArgs>;
        _xmppClient: XmppClient;
        _saslProc: SaslProcessor;
        constructor(xmppClient: XmppClient);
        private streamElementHandler;
        startSasl(features: Xmpp.Stream.StreamFeatures): void;
        private selectSaslMechanism(mechanisms);
        private endSasl();
    }
}
declare module Matrix {
    import XmppXElement = Xml.XmppXElement;
    class StanzaEventArgs extends EventArgs {
        _stanza: XmppXElement;
        constructor(stanza?: XmppXElement);
        stanza: XmppXElement;
    }
}
declare module Matrix {
    class StreamFeatureHelper {
        _tls: boolean;
        _sasl: boolean;
        _compression: boolean;
        _resourceBinding: boolean;
        _sessionRequired: boolean;
        sasl: boolean;
        resourceBinding: boolean;
        sessionRequired: boolean;
        reset(): void;
    }
}
declare module Matrix.Xml.Factory {
    function create<T>(c: {
        new (): T;
    }): T;
    function registerElement<T extends XmppXElement>(ns: string, tagname: string, el: {
        new (): T;
    }): void;
    function getElement(prefix: string, localName: string, ns: string): XmppXElement;
}
declare module Matrix.Xml {
    import GenericEvent = Matrix.GenericEvent;
    class XmppStreamParser {
        onStreamStart: GenericEvent<StanzaEventArgs>;
        onStreamElement: GenericEvent<StanzaEventArgs>;
        onStreamEnd: GenericEvent<EventArgs>;
        onStreamError: GenericEvent<ExceptionEventArgs>;
        onError: GenericEvent<ExceptionEventArgs>;
        _depth: number;
        _root: XmppXElement;
        _current: XmppXElement;
        _parser: sax.SAXParser;
        saxOpts: sax.SAXOptions;
        constructor();
        reset(): void;
        private initParser();
        write(data: string): void;
    }
}
declare module Matrix.Xmpp.Base {
    class Stream extends XmppXElementWithAddressAndIdAndVersion {
        constructor();
    }
}
declare module Matrix.Xmpp.Base {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class XmppXElementWithIdAttribute extends XmppXElement {
        constructor(ns: string, tagname: string);
        id: string;
    }
}
declare module Matrix.Xmpp.Sasl {
    import XmppXElement = Matrix.Xml.XmppXElement;
    import SaslMechanism = Matrix.Sasl.SaslMechanism;
    class Mechanisms extends XmppXElement {
        constructor();
        getMechanisms(): linqjs.Enumerable;
        supportsMechanism(mech: SaslMechanism): boolean;
        getMechanism(mech: SaslMechanism): Mechanism;
    }
}
declare module Matrix.Xmpp.Stream.Features {
    import XmppXElement = Matrix.Xml.XmppXElement;
    class Register extends XmppXElement {
        constructor();
    }
}
declare module Matrix.Xmpp.Stream {
    import XmppXElement = Matrix.Xml.XmppXElement;
    import Mechanisms = Matrix.Xmpp.Sasl.Mechanisms;
    class StreamFeatures extends XmppXElement {
        constructor();
        mechanisms: Mechanisms;
        supportsBind: boolean;
        supportsSession: boolean;
    }
}
declare module Matrix.Crypt.MD5 {
    function hexdigest(s: string): string;
    function b64digest(s: string): string;
    function hash(s: string): string;
    function hmac_hexdigest(key: any, data: any): string;
    function hmac_b64digest(key: any, data: any): string;
    function hmac_hash(key: any, data: any): string;
}
declare module Matrix.Xmpp.Client {
    class Stream extends Xmpp.Base.Stream {
        constructor();
    }
}
