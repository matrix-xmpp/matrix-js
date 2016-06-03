/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/Presence.ts" />
module Matrix.Xmpp.Client {
    "use strict";
    export class Presence extends Base.Presence {
        constructor() {
            super(Namespaces.client);
        }
    }
} 