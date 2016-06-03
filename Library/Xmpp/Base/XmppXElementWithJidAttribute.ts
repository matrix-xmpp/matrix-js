/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../xml/XmppXElement.ts" />
/// <reference path="../../Jid.ts" />
module Matrix.Xmpp.Base {

    import XmppXElement = Matrix.Xml.XmppXElement;

    export class XmppXElementWithJidAttribute extends XmppXElement {
        constructor(ns: string, tagname: string) {
            super(ns, tagname);
        }
        
        public get jid(): Jid { return this.getAttributeJid("jid");}
        public set jid(value: Jid) { this.setAttributeJid("jid", value); }
    }
}   