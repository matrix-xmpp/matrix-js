/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="xmpp/sasl/mechanism.ts" />
/// <reference path="sasl/saslprocessor.ts" />
/// <reference path="xmpp/sasl/sasleventargs.ts" />
/// <reference path="sasl/saslfactory.ts" />
/// <reference path="xmpp/sasl/success.ts" />
/// <reference path="xmpp/sasl/failure.ts" />
module Matrix {
    "use strict";

    import Mechanisms = Matrix.Xmpp.Sasl.Mechanisms;
    import SaslProcessor = Matrix.Sasl.SaslProcessor;
    import SaslEventArgs = Matrix.Xmpp.Sasl.SaslEventArgs;
    import SaslFactory = Matrix.Sasl.SaslFactory;
    import SaslMechanism = Matrix.Sasl.SaslMechanism;
    import DigestMd5Processor = Matrix.Sasl.DigestMD5Processor;
    import Challenge = Matrix.Xmpp.Sasl.Challenge;
    import Success = Matrix.Xmpp.Sasl.Success;
    import Failure = Matrix.Xmpp.Sasl.Failure;
    import SaslMechanismPriorities = Sasl.saslMechanismPriorities;

    export class SaslHandler {
        
        // Events
        public onSaslStart = new GenericEvent<SaslEventArgs>();
        public onSaslSuccess = new GenericEvent<EventArgs>();
        public onSaslFailure = new GenericEvent<SaslEventArgs>();


        _xmppClient: XmppClient;
        _saslProc: SaslProcessor;

        constructor(xmppClient: XmppClient) {
            this._xmppClient = xmppClient;
        }
        
        private streamElementHandler = (args: StanzaEventArgs) => {
            var el = args.stanza;
            if (el instanceof Success)
            {
                this.endSasl();

                this.onSaslSuccess.trigger(new EventArgs());
            }
            else if (el instanceof Failure)
            {
                this.endSasl();
                this.onSaslFailure.trigger(new SaslEventArgs(el));
            }
            else if (el instanceof Challenge)
            {
                if (this._saslProc != null)
                    this._saslProc.parse(el);
            }
        };

        public startSasl(features: Xmpp.Stream.StreamFeatures): void {
            var mechanisms = features.mechanisms;

            this._xmppClient.xmppStreamParser.onStreamElement.on(this.streamElementHandler);

            var saslArgs = new SaslEventArgs();
            saslArgs.auto = true;
            saslArgs.mechanisms = mechanisms;
            
            // pass XmppClient object to sender in event args
            this.onSaslStart.trigger(saslArgs);
            

            if (saslArgs.auto)
                this._saslProc = this.selectSaslMechanism(mechanisms);
            else {
                if (!Util.Functions.isUndefined(saslArgs.customSaslProcessor))
                    this._saslProc = saslArgs.customSaslProcessor;
                else
                    this._saslProc = SaslFactory.create(saslArgs.saslMechanism);
            }

            if (this._saslProc != null) {
                //this._saslProc.SaslProperties = saslArgs.SaslProperties;

                this._saslProc.username = this._xmppClient.username;
                this._saslProc.password = this._xmppClient.password;
                this._saslProc.server   = this._xmppClient.xmppDomain;

                this._saslProc.init(this._xmppClient);
            }
        }

        private selectSaslMechanism(mechanisms: Mechanisms): SaslProcessor {
            for (var i = 0; i < SaslMechanismPriorities.length; i++) {
                var mech = SaslMechanismPriorities[i];
                if (mechanisms.supportsMechanism(mech))
                    return SaslFactory.create(mech);
            }
            return null; // TODO throw ex
        }

        private endSasl(): void
        {
            // Remove event handlers
            this._xmppClient.xmppStreamParser.onStreamElement.off(this.streamElementHandler);
            // destroy SaslProcessor
            this._saslProc = null;
        }
    }
} 