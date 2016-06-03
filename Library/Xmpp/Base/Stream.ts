/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="XmppXElementWithAddressAndIdAndVersion.ts" />
/// <reference path="../../Namespaces.ts" />
module Matrix.Xmpp.Base {
    "use strict";
    export class Stream extends XmppXElementWithAddressAndIdAndVersion {
        constructor() {
            super(Namespaces.stream, "stream", "stream");
        }
    }
}  