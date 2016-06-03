/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/XmppXElementWithJidAttribute.ts" />
module Matrix.Xmpp.Muc {
    "use strict";

    import XmppXElementWithJidAttribute = Base.XmppXElementWithJidAttribute;

    export class Conference extends XmppXElementWithJidAttribute {
        constructor() {
            super(Namespaces.xConference, "x");
        }

        public get password(): string {
            return this.getAttribute("password");
        }
        public set password(value: string) {
            this.setAttribute("password", value);
        }

        public get reason(): string {
            return this.getAttribute("reason");
        }
        public set reason(value: string) {
            this.setAttribute("reason", value);
        }
    }
}  