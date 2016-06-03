/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../../Xml/XmppXElement.ts" />
module Matrix.Xmpp.Stream.Features {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;
    
    export class Register extends XmppXElement {
        constructor() {
            super(Namespaces.featureIqRegister, "register");
        }
    }
}  