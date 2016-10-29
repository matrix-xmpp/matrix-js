/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="iqeventargs.ts" />
/// <reference path="exceptioneventargs.ts" />
/// <reference path="xmpp/sasl/sasleventargs.ts" />
/// <reference path="net/boshsocket.ts" />
/// <reference path="net/isocket.ts" />
/// <reference path="xmpp/client/presence.ts" />
/// <reference path="xmpp/show.ts" />
/// <reference path="xmpp/roster/rostereventargs.ts" />
/// <reference path="jideventargs.ts" />
/// <reference path="iqfilter.ts" />
/// <reference path="util/base64.ts" />
/// <reference path="Events.ts" />
/// <reference path="net/WebSocketEx.ts" />
/// <reference path="_references.ts" />
/// <reference path="xmpp/sasl/sasleventargs.ts" />
/// <reference path="xmpp/client/iqquery.ts" />
/// <reference path="net/isocket.ts" />

module Matrix {

    "use strict";

    import WebSocketEx = Matrix.Net.WebSocketEx;
    import XmppStreamParser = Matrix.Xml.XmppStreamParser;
    import XmppXElement = Matrix.Xml.XmppXElement;
    import Message = Matrix.Xmpp.Client.Message;
    import Iq = Matrix.Xmpp.Client.Iq;
    import Presence = Matrix.Xmpp.Client.Presence;
    import SaslEventArgs = Matrix.Xmpp.Sasl.SaslEventArgs;
    import IqQuery = Matrix.Xmpp.Client.IqQuery;
    import IqType = Matrix.Xmpp.IqType;
    import RosterEventArgs = Matrix.Xmpp.Roster.RosterEventArgs;
    import Show = Matrix.Xmpp.Show;
    import Socket = Matrix.Net.ISocket;
    import BoshSocket = Matrix.Net.BoshSocket;
    
    export class XmppClient
    {
        // Events
        public onReadXml = new GenericEvent<TextEventArgs>();
        public onWriteXml = new GenericEvent<TextEventArgs>();
        public onStreamFeatures = new GenericEvent<StanzaEventArgs>();

        public onIq = new GenericEvent<IqEventArgs>();
        public onPresence = new GenericEvent<PresenceEventArgs>();
        public onMessage = new GenericEvent<MessageEventArgs>();

        public onBind = new GenericEvent<JidEventArgs>();
        public onBindStart = new GenericEvent<IqEventArgs>();
        public onBindError = new GenericEvent<IqEventArgs>();

        public onLogin = new GenericEvent<EventArgs>();
        public onClose = new GenericEvent<EventArgs>();
        public onSessionReady = new GenericEvent<EventArgs>();

        public onRosterStart = new GenericEvent<EventArgs>();
        public onRosterItem = new GenericEvent<RosterEventArgs>();
        public onRosterEnd = new GenericEvent<EventArgs>();

        public onSaslStart = new GenericEvent<SaslEventArgs>();

        public onError = new GenericEvent<ExceptionEventArgs>();
    

        private _socket = null;
        private _xmppDomain: string;
        private _username: string;
        private _password: string;
        private _resource: string = "MatriX.js";
        private _port: number = 5280;
        private _autoRoster: boolean = true;
        private _autoPresence: boolean = true;
        private _receivedOwnPresence: boolean = false;

        private _priority: number = 0;
        private _show: Show = Show.None;
        private _status: string = null;
        private _uri: string = null;
        private _transport: Transport = Transport.Websocket;
        private _myJid: Jid;

        private _xmppStreamParser = new Matrix.Xml.XmppStreamParser;
        private _streamFeatureHelper = new StreamFeatureHelper();
        private _saslHandler = new SaslHandler(this);
        private _iqFilter = new IqFilter(this);

        //constructor(username: string, password: string, xmppDomain: string, port: number);
        constructor(username?: string, password?: string, xmppDomain?: string) {
            if (!Util.Functions.isUndefined(username))
                this._username = username;

            if (!Util.Functions.isUndefined(password))
                this._password   = password;

            if (!Util.Functions.isUndefined(xmppDomain))
                this._xmppDomain = xmppDomain;

            this.initStreamParser();
            this.initSaslHandler();
        }
        
        private initSocket(): void {
            if (this.transport == Transport.Websocket)
                this._socket = new WebSocketEx(this);
            else if(this.transport == Transport.Bosh)
                this._socket = new BoshSocket(this);

            this._socket.xmppClient = this;

            this._socket.onConnect.on((args: EventArgs) => {
                this.sendStreamHeader();
            });

            this._socket.onDisconnect.on((args: EventArgs) => {
                this.onClose.trigger(args);
            });

            this._socket.onReadData.on((args: TextEventArgs) =>
            {
                this.onReadXml.trigger(args);
                if (this.transport == Transport.Websocket) {
                    var el = XmppXElement.loadXml(args.text);
                    this._xmppStreamParser.onStreamElement.trigger(new StanzaEventArgs(el));
                }
            });

            this._socket.onWriteData.on((args: TextEventArgs) => {
                this.onWriteXml.trigger(new TextEventArgs(args.text));
            });

            this._socket.onError.on((args: ExceptionEventArgs) => {
                this.onError.trigger(args);
            });
        }

        public get xmppDomain(): string { return this._xmppDomain; }
        public set xmppDomain(value: string) { this._xmppDomain = value; }

        public get username(): string { return this._username; }
        public set username(value: string) { this._username = value; }

        public get password(): string { return this._password; }
        public set password(value: string) { this._password = value; }

        public get resource(): string { return this._resource; }
        public set resource(value: string) { this._resource = value; }

        public get port(): number { return this._port; }
        public set port(value: number) { this._port = value; }

        public get xmppStreamParser(): Matrix.Xml.XmppStreamParser { return this._xmppStreamParser; }
        public get iqFilter(): IqFilter { return this._iqFilter; }

        public get autoRoster(): boolean { return this._autoRoster; }
        public set autoRoster(value: boolean) { this._autoRoster = value; }

        public get autoPresence(): boolean { return this._autoPresence; }
        public set autoPresence(value: boolean) { this._autoPresence = value; }
        
        public get priority(): number { return this._priority; }
        public set priority(value: number) { this._priority = value; }

        public get show(): Show { return this._show; }
        public set show(value: Show) { this._show = value; }

        public get status(): string { return this._status; }
        public set status(value: string) { this._status = value; }

        /* gets the websocket or bosh uri */
        public get uri(): string { return this._uri; }
        /* sets the websocket or bosh uri */
        public set uri(value: string) { this._uri = value; }

        public get transport(): Transport { return this._transport; }
        public set transport(value: Transport) { this._transport = value; }

        public open() : void {
            if (this._socket == null)
               this.initSocket();
            
            this._socket.connect();
        }

        public close(): void {
            this.sendStreamFooter();
            //this._socket.disconnect();
        }

        public send(xml: XmppXElement | string): void {
            this._socket.send(xml);
        }

        private initStreamParser(): void {
            this._xmppStreamParser.onStreamStart.on((args: StanzaEventArgs) => {
                
            });

            this._xmppStreamParser.onStreamElement.on((args: StanzaEventArgs) => {
                if (args.stanza instanceof Xmpp.Client.Message)
                    this.onMessage.trigger(new MessageEventArgs(<Message>args.stanza));
                else if (args.stanza instanceof Xmpp.Client.Iq)
                    this.processIq(<Iq> args.stanza);
                else if (args.stanza instanceof Xmpp.Client.Presence) {
                    var pres = <Presence>args.stanza;
                    
                    if (!this._receivedOwnPresence
                        && !Util.Functions.isUndefined(this._myJid)
                        && pres.from.full === this._myJid.full) {
                        this.onSessionReady.trigger(new EventArgs());
                        this._receivedOwnPresence = true;
                    }
                    this.onPresence.trigger(new PresenceEventArgs(pres));
                }
                    
                else if (args.stanza instanceof Xmpp.Stream.StreamFeatures)
                    this.processStreamFeatures(<Xmpp.Stream.StreamFeatures>args.stanza);
            });

            this._xmppStreamParser.onStreamEnd.on((args: EventArgs) => {
                
            });        
        } 
        
        private initSaslHandler() {
            this._saslHandler.onSaslStart.on((args: SaslEventArgs) => {
                this.onSaslStart.trigger(args);
            });

            this._saslHandler.onSaslSuccess.on((args: EventArgs) => {
                this._streamFeatureHelper.sasl = true;

                // we are authenticated
                //raise OnLlogin event
                this.onLogin.trigger(new EventArgs());
                this.streamReset();
            });

            this._saslHandler.onSaslFailure.on((args: SaslEventArgs) => {

            });
            
        }
        /// Do a stream reset
        private streamReset(): void {
            this._xmppStreamParser.reset();
            this.sendStreamHeader();
        }

        private sendStreamHeader() {
            // build the stream header
            if (this.transport == Transport.Websocket) {
                var open = new Xmpp.Framing.Open();
                open.version = "1.0";
                open.to = new Jid(this.xmppDomain);
                this.send(open.toString());
            }
            else if (this.transport == Transport.Bosh) {
                this.send(new Xmpp.Client.Stream());
            }
        }

        private sendStreamFooter() {
            // build the stream footer
            if (this.transport == Transport.Websocket) {
                this.send(new Xmpp.Framing.Close());

            } else {
                var stream = new Xmpp.Client.Stream();
                this.send(stream.endTag());
            }
        }

        private processIq(iq: Iq): void {
            this.onIq.trigger(new IqEventArgs(iq));

            var query = iq.getFirstXmppXElement();

            if (query instanceof Matrix.Xmpp.Roster.Roster)
                this.processRosterIq(iq);
        }

        private processRosterIq(iq: Iq): void {
            this.onIq.trigger(new IqEventArgs(iq));

            var roster = iq.elementOfType(Matrix.Xmpp.Roster.Roster);
            
            var iqType = iq.type;

            if (iqType == IqType.Result)
                this.onRosterStart.trigger(new EventArgs());

            roster.getRoster().forEach(
                (ri) => this.onRosterItem.trigger(new RosterEventArgs(ri, roster.version))
            );

            if (iqType == IqType.Result)
                this.onRosterEnd.trigger(new EventArgs());

            // acknowledge roster pushes
            if (iqType == IqType.Set)
            {
                var ack = new Iq();
                ack.type = IqType.Result;
                ack.id = iq.id;
                this.send(ack);
            }

            if (iqType == IqType.Result && this.autoPresence)
                this.sendInitialPresence();
        }

        private processStreamFeatures(features: Xmpp.Stream.StreamFeatures): void {
            /*
                 XEP-0170
                 1. TLS
                 2. SASL
                      2.1 Stream Management
                 3. Stream compression
                 4. Resource binding
              */
            
            // trigger event
            this.onStreamFeatures.trigger(new StanzaEventArgs(features));
         
            if (!this._streamFeatureHelper.sasl) {
            //    // Do Sasl authentication
                this._saslHandler.startSasl(features);
            }
            else if (!this._streamFeatureHelper.resourceBinding) {
                if (features.supportsSession)//&& !features.Session.Optional)
                    this._streamFeatureHelper.sessionRequired = true;

                if (features.supportsBind)
                    this.bindResource();
            }
        }

        private bindResource() :void
        {
            /*        
             SENT: <iq id="jcl_1" type="set">
                        ns="urn:ietf:params:xml:ns:xmpp-bind">
                            <resource>Exodus</resource>
                        </bind>
                   </iq>
         
             RECV: <iq id='jcl_1' type='result'>
                        ns='urn:ietf:params:xml:ns:xmpp-bind'>
                            <jid>gnauck@jabber.ru/Exodus</jid>
                        </bind>
                 
            */
            var bIq = new IqQuery(Matrix.Xmpp.Bind.Bind);
            bIq.generateId();
            bIq.type = IqType.Set;
            bIq.query.resource = this.resource;
            
            this.onBindStart.trigger(new IqEventArgs(bIq));

            this.iqFilter.sendIq(bIq, this.bindResult);
        }

        private bindResult = (args: IqEventArgs) => {
            var iq = args.iq;

            if (iq.type == IqType.Error) {
                // bind error
                this.onBindError.trigger(new IqEventArgs(iq));
            }
            else if (iq.type == IqType.Result) {
                var bind = iq.elementOfType(Matrix.Xmpp.Bind.Bind);
                if (bind != null) {
                    var jid = bind.jid;
                    this._myJid = jid;

                    this.onBind.trigger(new JidEventArgs(jid));

                    this._streamFeatureHelper.resourceBinding = true;
                }
            }

            if (this._streamFeatureHelper.sessionRequired) {
                this.requestSession();
            } else {
                if (this.autoRoster)
                    this.requestRoster();
                else if (this.autoPresence)
                    this.sendInitialPresence();
            }
        }

        public requestRoster(version:string = null) : void {
            var riq = new IqQuery(Matrix.Xmpp.Roster.Roster);
            riq.generateId();
            riq.type = IqType.Get;

            if (version != null)
                riq.query.version = version;

            this.send(riq);
        }

        private requestSession(): void {
            var sIq = new IqQuery(Matrix.Xmpp.Session.Session);
            sIq.generateId();
            sIq.type = IqType.Set;
            
            this.iqFilter.sendIq(sIq, this.requestSessionResult);
        }

        private requestSessionResult = (args: IqEventArgs) => {
            // request the roster
            if (this.autoRoster)
                this.requestRoster();
            else if (this.autoPresence)
                this.sendInitialPresence();
        }

        private sendInitialPresence(): void {
            this.sendPresence();
        }

        public sendPresence(show?: Show, status?: string, priority?: number) {
            // set new property values when given
            if (typeof show !== 'undefined')
                this.show = show;

            if(!Util.Functions.isUndefined(status))
                this.status = status;
            
            if (!Util.Functions.isUndefined(priority))
                this.priority = priority;

            // build and send the presence packet
            var pres = new Matrix.Xmpp.Client.Presence();

            pres.show = this.show;
            pres.priority = this.priority;

            if (this.status != null)
                pres.status = this.status;

            this.send(pres);
        }
    }
} 