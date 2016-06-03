/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Util.Functions {
    
    /**
     * Checks if the given argument is a function.
     * @function     
     */
    export function isFunction(func: any): boolean {
        return (typeof func) === 'function';
    }

    /**
     * Checks if the given argument is undefined.
     * @function
     */
    export function isUndefined(obj: any): boolean {
        return (typeof obj) === 'undefined';
    }

    /**
     * Checks if the given argument is a string.
     * @function
     */
    export function isString(obj: any): boolean {
        return Object.prototype.toString.call(obj) === '[object String]';
    }

    export function textFormat(source: string, ...args: any[]) {
        for (var i = 0; i < args.length; i++)
            source = source.replace("{" + i + "}", args[i]);
        return source;
    }

    export function hexToString(byteArray: Array<number>): string {
        var str = '';
        byteArray.forEach(b => {
            var hex = (b.toString(16));
            str += (hex.length < 2 ? '0' + hex : hex);
        });
        return str;
    }
} 