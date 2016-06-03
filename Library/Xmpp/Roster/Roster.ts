/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="RosterItem.ts" />
module Matrix.Xmpp.Roster {
    import XmppXElement = Matrix.Xml.XmppXElement;

    export class Roster extends XmppXElement {
        constructor() {
            super(Namespaces.iqRoster, "query");
        }
    
        public getRoster(): linqjs.Enumerable {
            return this.elementsOfType(Matrix.Xmpp.Roster.RosterItem);
        }

        public get version(): string {
            return this.getAttribute("ver");
        }

        public set version(value: string) {
            this.setAttribute("ver", value);
        }
    }
}  