/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../base/RosterItem.ts" />
/// <reference path="../../Namespaces.ts" />
module Matrix.Xmpp.Roster {
    
    export class RosterItem extends Matrix.Xmpp.Base.RosterItem {
        constructor() {
            super(Namespaces.iqRoster);
        }

        public get subscription(): Subscription {
            return <Subscription> this.getAttributeEnum("subscription", Subscription);
        }

        public set subscription(value: Subscription) {
            this.setAttributeEnum("subscription", Subscription, value);
        }

        public get ask(): Ask {
            return <Ask> this.getAttributeEnum("ask", Ask);
        }

        public set ask(value: Ask) {
            this.setAttributeEnum("ask", Ask, value);
        }

        public get approved(): boolean {
            return this.getAttributeBoolean("approved");
        }

        public set approved(value: boolean) {
            this.setAttributeBoolean("approved", value);
        }
    }
} 