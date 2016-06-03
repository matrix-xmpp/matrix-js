/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../../Xml/XmppXElement.ts" />
module Matrix.Xmpp.Muc.User {
    "use strict";
    import XmppXElement = Matrix.Xml.XmppXElement;

    export class Status extends XmppXElement {
        constructor() {
            super(Namespaces.mucUser, "status");
        }

        public get codeInt(): number {
            return this.getAttributeNumber("code"); 
        }
        public set codeInt(value: number) {
            this.setAttributeNumber("code", value);
        }

        public get statusCode(): StatusCode {
            var code = this.codeInt;
            if (code > 0)
                return code;
            else
                return StatusCode.Unknown;
        }
        public set statusCode(value: StatusCode) {
            if (value != StatusCode.Unknown)
                this.codeInt = value;
        }
    }
}