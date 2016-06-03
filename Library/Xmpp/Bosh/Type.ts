/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp.Bosh {
    export enum Type {
        None = -1,
        Error = 0,
        Terminate = 1
    }
    Object.freeze(Type);
} 