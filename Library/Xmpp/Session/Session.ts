/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../../Namespaces.ts" />
module Matrix.Xmpp.Session {

    import XmppXElement = Matrix.Xml.XmppXElement;

    export class Session extends XmppXElement {
        constructor() {
            super(Namespaces.session, "session");
        }
    }
} 