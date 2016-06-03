/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Roster/Ask.ts" />
/// <reference path="../Roster/Subscription.ts" />
/// <reference path="Item.ts" />
module Matrix.Xmpp.Base {
    import Subscription = Matrix.Xmpp.Roster.Subscription;
    import Ask = Matrix.Xmpp.Roster.Ask;

    export class RosterItem extends Item {
        constructor(ns: string) {
            super(ns);
        }

       
    }
}