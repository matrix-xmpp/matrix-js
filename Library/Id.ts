/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix {
    "use strict";

    export class Id {
        static _prefix = "MX_";
        static _counter = 0;

        public static getNextId():string {
            this._counter++;
            return this._prefix + this._counter;
         }
    }
} 