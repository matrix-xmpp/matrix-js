/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../typings/ltxml.d.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="saslprocessor.ts" />
module Matrix.Sasl {
    "use strict";

    import Auth = Matrix.Xmpp.Sasl.Auth;

    export class AnonymousProcessor extends SaslProcessor {
        public init(xmppClient: XmppClient): void {
            super.init(xmppClient);
            xmppClient.send(new Auth(SaslMechanism.Anonymous));
        }
    }
}  