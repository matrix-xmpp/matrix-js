/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../xml/XmppXElement.ts" />
module Matrix.Xmpp.Base {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;
    
    export class XmppXElementWithIdAttribute extends XmppXElement {
        constructor(ns: string, tagname: string) {
            super(ns, tagname);
        }

        public get id(): string {
            return this.getAttribute("id");
        }

        public set id(value: string) {
            this.setAttribute("id", value);
        }
    }
} 