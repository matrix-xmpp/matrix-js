/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../../Xml/XmppXElement.ts" />
module Matrix.Xmpp.Muc.User {
    "use strict";
    import XmppXElement = Matrix.Xml.XmppXElement;

    export class Continue extends XmppXElement {
        constructor() {
            super(Namespaces.mucUser, "continue");
        }

        public get thread(): string {
            return this.getAttribute("tread");
        }
        public set thread(value: string) {
            this.setAttribute("thread", value);
        }
    }
}