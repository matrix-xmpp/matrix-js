/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/Iq.ts" />
/// <reference path="../../Namespaces.ts" />
module Matrix.Xmpp.Client {
    "use strict";
    export class Iq extends Base.Iq {
        constructor() {
            super(Namespaces.client);
        }
    }
}  