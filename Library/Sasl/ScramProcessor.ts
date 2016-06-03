/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../xmpp/sasl/response.ts" />
/// <reference path="../util/base64.ts" />
/// <reference path="scram/scramhelper.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="../xmpp/sasl/challenge.ts" />
module Matrix.Sasl {
    "use strict";

    import Auth = Matrix.Xmpp.Sasl.Auth;
    import Challenge = Matrix.Xmpp.Sasl.Challenge;
    import ScramHelper = Matrix.Sasl.Scram.ScramHelper;
    import Base64 = Matrix.Util.Base64;
    import Response = Matrix.Xmpp.Sasl.Response;

    export class ScramProcessor extends SaslProcessor {
        private scramHelper: ScramHelper;

        public init(xmppClient: XmppClient): void {
            super.init(xmppClient);
            
            this.scramHelper = new ScramHelper();
            var msg = Base64.encode(this.scramHelper.generateFirstClientMessage(this.username));
            this.xmppClient.send(new Auth(SaslMechanism.ScramSha1, msg));
        }
       
        public parse(ch: Challenge): void {
            var firstServerMessage =  ch.getValueFromBase64();
            var clientFinalMessage = this.scramHelper.generateFinalClientMessage(firstServerMessage, this.password);
            this.xmppClient.send(new Response(Base64.encode(clientFinalMessage)));
        }
    }
}   