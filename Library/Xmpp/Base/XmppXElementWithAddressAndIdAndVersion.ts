/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
module Matrix.Xmpp.Base {
    "use strict";
    export class XmppXElementWithAddressAndIdAndVersion extends XmppXElementWithAddressAndId {

        constructor(ns: string, tagname: string, prefix?: string) {
            super(ns, tagname, prefix);
        }

        public get version(): string { return this.getAttribute("version"); }
        public set version(value: string) { this.setAttribute("version", value); }
    }
} 