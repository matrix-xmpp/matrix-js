/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="History.ts" />
module Matrix.Xmpp.Muc {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;

    export class X extends XmppXElement {
        constructor() {
            super(Namespaces.muc, "X");
        }

        public get password() : string {
            return this.getAttribute("password");
        }
        public set password(value: string) {
            this.setAttribute("password", value);
        }

        public get history(): History {
            return this.elementOfType(History);
        }
        public set history(value: History) {
            this.replace(History, value);
        }
    }
} 