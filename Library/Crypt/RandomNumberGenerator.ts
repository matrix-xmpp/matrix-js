/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Crypt {

    "use strict";

    export class RandomNumberGenerator {
        static create(): RandomNumberGenerator
        {
            return new RandomNumberGenerator();
        }

        public getBytes(array : Array<number>)
        {
            var validChars: string = "abcdefghijklmnopqrstuvwxyzABCEDFGHIJKLMNOPQRSTUVWXYZ1234567890";

            var low = 0;
            var high = validChars.length;

            var length: number = array.length;

            for (var i: number = 0; i < length; i++) {
                var idx = Math.floor(Math.random() * (high - low) + low);
                array[i] = validChars.charCodeAt(idx);
            }
        }

        public getString(length: number) {
            var low = 0;
            var high = 255;
            var s = "";
            for (var i: number = 0; i < length; i++) {
                var idx = Math.floor(Math.random() * (high - low) + low);
                s += String.fromCharCode(idx);
            }
            return s;
        }

        public getNumber(min: number, max: number) : number {
            return Math.floor(Math.random() * (max - min)) + min;
        }
    }
} 