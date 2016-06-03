/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp.Muc {
    "use strict";

    export enum Affiliation {
        /// <summary>
        /// the absence of an affiliation
        /// </summary>
        //[Name("none")]
        None,

        //[Name("owner")]
        Owner,
        
        //[Name("admin")]
        Admin,
        
        //[Name("member")]
        Member,
        
        //[Name("outcast")]
        Outcast
    }
    Object.freeze(Affiliation);
}  