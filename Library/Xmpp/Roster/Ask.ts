/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp.Roster {
    export enum Ask {
        None = -1,
        //[Name("subscribe")]
        Subscribe,

        //[Name("unsubscribe")]
        Unsubscribe
    }
    Object.freeze(Ask);
}