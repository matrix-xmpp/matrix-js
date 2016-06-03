/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../util/base64.ts" />
/// <reference path="../typings/ltxml.d.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="saslprocessor.ts" />
module Matrix.Sasl {
    "use strict";

    import Auth = Matrix.Xmpp.Sasl.Auth;

    export class PlainProcessor extends SaslProcessor {
        public init(xmppClient: XmppClient): void {
            super.init(xmppClient);
            xmppClient.send(new Auth(SaslMechanism.Plain, this.getMessage()));
        }

        private getMessage(): string {	  
            // NULL Username NULL Password
            var str: string = "";
            str = str + "\u0000";
            str = str + this.xmppClient.username;
            str = str + "\u0000";
            str = str + this.xmppClient.password;
            return Util.Base64.encode(str);
        }
    }
} 