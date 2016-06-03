/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="Iq.ts" />
/// <reference path="../../Xml/XmppXElement.ts" />
module Matrix.Xmpp.Client {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;

    export class IqQuery<T extends XmppXElement> extends Iq {
        private _query: T;

        constructor(query: { new (): T; }) {
            super();

            this._query = new query();
            this.add(this._query);
        }
        
        public get query(): T {
            return this._query;
        }
    }
} 