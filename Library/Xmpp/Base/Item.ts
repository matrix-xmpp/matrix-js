/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="XmppXElementWithJidAttribute.ts" />
module Matrix.Xmpp.Base {

    export class Item extends XmppXElementWithJidAttribute {
        constructor(ns: string) {
            super(ns, "item");
        } 
        // TODO, find a better name here
        public get nickname(): string { return this.getAttribute("name"); }
        public set nickname(value: string) { this.setAttribute("name", value); }
    }
}  