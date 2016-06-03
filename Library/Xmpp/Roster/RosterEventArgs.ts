/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Eventargs.ts" />
/// <reference path="RosterItem.ts" />
module Matrix.Xmpp.Roster {
    export class RosterEventArgs extends EventArgs {
        constructor(rosterItem: RosterItem, version?: string) {
            super();
            this.rosterItem = rosterItem;
            this.version    = version;
        }
        private _rosterItem: RosterItem;
        private _version: string;

        public get rosterItem(): RosterItem { return this._rosterItem; }
        public set rosterItem(value: RosterItem) { this._rosterItem = value; }

        public get version(): string { return this._version; }
        public set version(value: string) { this._version = value; }
    }
}