/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="XmppXElementWithAddress.ts" />
/// <reference path="../../Id.ts" />
module Matrix.Xmpp.Base {
    "use strict";
    export class XmppXElementWithAddressAndId extends XmppXElementWithAddress {
       
        constructor(ns: string, tagname: string, prefix?: string) {
            super(ns, tagname, prefix);
        }

        public get id(): string {
            return this.getAttribute("id");
        }

        public set id(value: string) {
            this.setAttribute("id", value);
        }

        /* Generates a automatic id for the packet. !!! Overwrites existing Ids */
        public generateId()
        {
            var sId = Matrix.Id.getNextId();
            this.id = sId;
        }
    }
}