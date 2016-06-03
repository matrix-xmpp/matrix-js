/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp.Base {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;

    export class Sasl extends XmppXElement {
        constructor(tag: string) {
            super(Namespaces.sasl, tag);
        }
    }
}    