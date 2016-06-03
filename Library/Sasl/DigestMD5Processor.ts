/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../util/base64.ts" />
/// <reference path="digest/step2.ts" />
/// <reference path="digest/step1.ts" />
/// <reference path="saslprocessor.ts" />
/// <reference path="../xmpp/sasl/challenge.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="../xmpp/sasl/response.ts" />
module Matrix.Sasl {
    "use strict";

    import Base64 = Matrix.Util.Base64;
    import Challenge = Matrix.Xmpp.Sasl.Challenge;
    import Auth = Matrix.Xmpp.Sasl.Auth;
    import Response = Matrix.Xmpp.Sasl.Response;
    import Step1 = Matrix.Sasl.Digest.Step1;
    import Step2 = Matrix.Sasl.Digest.Step2;

    export class DigestMD5Processor extends SaslProcessor {
        public init(xmppClient: XmppClient): void {
            super.init(xmppClient);
            xmppClient.send(new Auth(SaslMechanism.DigestMd5));
        }

        public parse(ch: Challenge): void {
            var step1 = new Step1(Base64.decode(ch.value));
            if (step1.rspauth == null)
            {                
                var s2 = new Step2(step1, this);
                var message = s2.getMessage();
                this.xmppClient.send(new Response(Base64.encode(message)));
            }
            else
            {                
                this.xmppClient.send(new Response());
            }		
        }
    }
}  