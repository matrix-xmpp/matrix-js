/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="EventArgs.ts" />
module Matrix {

    export class TextEventArgs extends EventArgs {
        
        constructor(text: string) {
            super();
            this.text = text;
        }

        _text: string;

        public get text(): string { return this._text; }
        public set text(value: string) { this._text = value; }
    }
} 