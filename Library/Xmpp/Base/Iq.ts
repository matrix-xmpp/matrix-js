/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
/// <reference path="../IqType.ts" />
module Matrix.Xmpp.Base {
    "use strict";

    export class Iq extends XmppXElementWithAddressAndId {
        constructor(ns: string) {
            super(ns, "iq");
        }

        public get type(): IqType {
            return <IqType> this.getAttributeEnum("type", IqType);
        }
        public set type(value: IqType) {
            this.setAttributeEnum("type", IqType, value);
        }
    }
}   