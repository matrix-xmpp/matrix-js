/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/XmppXElementWithAddressAndIdAndVersion.ts" />
/// <reference path="../../Namespaces.ts" />
module Matrix.Xmpp.Framing {
    import XmppXElementWithAddressAndIdAndVersion = Matrix.Xmpp.Base.XmppXElementWithAddressAndIdAndVersion;

    export class Open extends XmppXElementWithAddressAndIdAndVersion {
        constructor() {
            super(Namespaces.framing, "open");
        }
    }
} 