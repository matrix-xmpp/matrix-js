/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../eventargs.ts" />
module Matrix.Net {

    export class WebRequestEventArgs extends EventArgs {

        private _tag: string;
        private _data: string;

        constructor(data:string, tag:string) {
            super();
            this._data = data;
            this._tag = tag;
        }

        public get tag(): string { return this._tag; }
        public set tag(value: string) { this._tag = value; }

        public get data(): string { return this._data; }
        public set data(value: string) { this._data = value; }
    }
} 