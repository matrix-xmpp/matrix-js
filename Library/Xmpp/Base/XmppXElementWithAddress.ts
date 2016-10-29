
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../../Jid.ts" />
module Matrix.Xmpp.Base {
    "use strict";
    import XmppXElement = Matrix.Xml.XmppXElement;

    export class XmppXElementWithAddress extends XmppXElement {
        
        constructor(ns: string, tagname: string, prefix?: string) {
            super(ns, tagname, prefix);
        }
        
        public get from(): Jid {
            return this.getAttributeJid("from");
        }

        public get to(): Jid {
            return this.getAttributeJid("to");
        }

        public set to(value: Jid) {
            this.setAttributeJid("to", value);
        }

        public set from(value: Jid) {
            this.setAttributeJid("form", value);
        }
        
        /* Switches the from and to attributes when existing*/
        public switchDirection()
        {
            // store existing bvalues
            var from    = this.from;
            var to      = this.to;

            // Remove from and to now
            this.removeAttribute("from");
            this.removeAttribute("to");

            // switch the values
            var helper = from;
            from = to;
            to = helper;

            // set them again
            this.from   = from;
            this.to =    to;
        }
    }
}     