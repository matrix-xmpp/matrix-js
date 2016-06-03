/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="EventArgs.ts" />
module Matrix {
    "use strict";
    export class ExceptionEventArgs extends EventArgs {

        _exception: string = null;

        constructor(ex: string) {
            super();
            if (ex)
                this._exception = ex;
        }

        public get exception(): string { return this._exception; }
    }
}
