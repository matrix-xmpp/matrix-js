/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/Stream.ts" />
/// <reference path="../../Namespaces.ts" />
module Matrix.Xmpp.Client {
    "use strict";
    
    export class Stream extends Xmpp.Base.Stream {
        constructor() {
            super();
            this.setAttribute("xmlns", Namespaces.client);
        }
    }
}  