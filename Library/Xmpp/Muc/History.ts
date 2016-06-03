/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
module Matrix.Xmpp.Muc {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;

    export class History extends XmppXElement {
        constructor() {
            super(Namespaces.muc, "history");
        }

        /// <summary>
        /// request the last xxx seconds of history when available
        /// </summary>
        public get seconds() : number {
            return this.getAttributeNumber("seconds");
        }

        public set seconds(value: number) {
            this.setAttributeNumber("seconds", value);
        }

        /// <summary>
        /// Request maximum stanzas of history when available
        /// </summary>
        public get maxStanzas() : number {
            return this.getAttributeNumber("maxstanzas");
        }
        public set maxStanzas(value: number) {
            this.setAttributeNumber("maxstanzas", value);
        }

        /// <summary>
        /// Request history from a given date when available
        /// </summary>
        public get since(): number {
            return this.getAttributeIso8601Date("since");
        }
        public set since(value: number) {
            this.setAttributeIso8601Date("since", value);
        }

        /// <summary>
        /// Limit the total number of characters in the history to "X" 
        /// (where the character count is the characters of the complete XML stanzas, 
        /// not only their XML character data).
        /// </summary>
        public get maxCharacters() : number {
            return this.getAttributeNumber("maxchars");
        }
        public set maxCharacters(value: number) {
            this.setAttributeNumber("maxchars", value);
        }
    }
}