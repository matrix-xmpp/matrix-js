/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix {
    "use strict";

    export class EventArgs {
        private _state: any;

        public get state(): any { return this._state; }
        public set state(value: any) { this._state = value; }
    }
}  