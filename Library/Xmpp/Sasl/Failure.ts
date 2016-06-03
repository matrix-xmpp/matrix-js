/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
module Matrix.Xmpp.Sasl {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;

    export class Failure extends XmppXElement {
        constructor() {
            super(Namespaces.sasl, "failure");
        }
    }
}       