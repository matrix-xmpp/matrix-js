/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Base/XmppXElementWithJidAttribute.ts" />
module Matrix.Xmpp.Muc.User {
    "use strict";
    import XmppXElementWithJidAttribute = Matrix.Xmpp.Base.XmppXElementWithJidAttribute;

    export class Actor extends XmppXElementWithJidAttribute {
        constructor() {
            super(Namespaces.mucUser, "actor");
        }

        public get nick(): string {
            return this.getAttribute("nick");
        }
        public set nick(value: string) {
            this.setAttribute("nick", value);
        }
    }
} 