/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="xml/XmppXElement.ts" />
/// <reference path="EventArgs.ts" />
module Matrix {

    "use strict";

    import XmppXElement = Xml.XmppXElement;

    export class StanzaEventArgs extends EventArgs {
        _stanza: XmppXElement;

        constructor(stanza?: XmppXElement) {
            super();
            if (stanza)
                this._stanza = stanza;
        }

        public get stanza(): XmppXElement { return this._stanza; }
    }
}