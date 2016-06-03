/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="EventArgs.ts" />
/// <reference path="Xmpp/Client/Presence.ts" />
module Matrix {

    "use strict";

    import Presence = Matrix.Xmpp.Client.Presence;
    
    export class PresenceEventArgs extends EventArgs {
        private _presence: Presence;

        constructor(presence: Presence) {
            super();
            this.presence = presence;
        }

        public get presence(): Presence { return this._presence; }
        public set presence(value: Presence) { this._presence = value; }
    }
}  