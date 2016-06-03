/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="Xmpp/Client/iq.ts" />
/// <reference path="EventArgs.ts" />
module Matrix {
    
    "use strict";

    import Iq = Matrix.Xmpp.Client.Iq;

    export class IqEventArgs extends EventArgs {
        private _iq: Iq;

        constructor(iq: Iq) {
            super();
            this.iq = iq;
        }

        public get iq(): Iq { return this._iq; }
        public set iq(value: Iq) { this._iq = value; }
    }
} 