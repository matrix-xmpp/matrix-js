/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="EventArgs.ts" />
/// <reference path="Jid.ts" />
module Matrix {

    "use strict";
    
    export class JidEventArgs extends EventArgs {
        private _jid: Jid;

        constructor(jid: Jid) {
            super();
            this.jid = jid;
        }

        public get jid(): Jid { return this._jid; }
        public set jid(value: Jid) { this._jid = value; }
    }
}  