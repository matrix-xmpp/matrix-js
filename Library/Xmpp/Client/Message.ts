/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/Message.ts" />
module Matrix.Xmpp.Client {
    "use strict";
    export class Message extends Base.Message {
        constructor() {
            super(Namespaces.client);
        }
    }
} 