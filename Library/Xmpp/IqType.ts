/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp {
    "use strict";

    export enum IqType {
        Get,
        Set,
        Result,
        Error
    }
    Object.freeze(IqType);
} 