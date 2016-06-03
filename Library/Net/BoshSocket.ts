/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../util/functions.ts" />
/// <reference path="webrequesteventargs.ts" />
/// <reference path="../crypt/randomnumbergenerator.ts" />
/// <reference path="isocket.ts" />
/// <reference path="../xmpp/bosh/body.ts" />
/// <reference path="../collections/queue.ts" />
/// <reference path="../collections/collections.ts" />
/// <reference path="../util/timer.ts" />
module Matrix.Net {
    
    import Body = Matrix.Xmpp.Bosh.Body;
    import XmppXElement = Matrix.Xml.XmppXElement;
    import Queue = Matrix.Collections.Queue;
    import XElement = Ltxml.XElement;
    import Type = Matrix.Xmpp.Bosh.Type;

    export class BoshSocket implements ISocket {
        // default values
        DEFAULT_WAIT: number                    = 120;
        DEFAULT_SEND_FUNC_INTERVAL: number      = 250;
        DEFAULT_RECONNECT_INTERVALS: number[]   = [1000, 2000, 5000, 10000];

        constructor(xmppClient: XmppClient) {
            this._xmppClient = xmppClient;
        }

        public onReadData   = new GenericEvent<TextEventArgs>();
        public onWriteData  = new GenericEvent<TextEventArgs>();
        public onConnect    = new GenericEvent<EventArgs>();
        public onDisconnect = new GenericEvent<EventArgs>();
        public onError      = new GenericEvent<ExceptionEventArgs>();

        private _xmppClient: XmppClient;

        private requestA: WebRequest;
        private requestB: WebRequest;

        private maxRidToGenerate: number    = 4503599627370496;
        private maxRidAllowed: number       = 9007199254740991;

        private BOSH_VERSION: string = "1.6";
        
        private sid: string;
        private rid: number;
        private wait: number = this.DEFAULT_WAIT;
        private inactivity: number = 0;
        private terminate: boolean = false;
        private clientTerminated: boolean = false;
        private serverTerminated: boolean = false;
        private sessionStarted: boolean = false;
        private deadTime: Date = null;
        private sendQueue = new Queue<XmppXElement>();
        
        
        private sendFuncInterval: number; // 1 second
        
        private reconnectIntervalsIndex: number;
        
        //#region public methods
        public connect(): void {
            this.requestA = new WebRequest(this._xmppClient.uri, "A");
            this.requestB = new WebRequest(this._xmppClient.uri, "B");

            this.requestA.onReadData.on(this.readDataHandler);
            this.requestB.onReadData.on(this.readDataHandler);

            this.requestA.onSendData.on(this.sendDataHandler);
            this.requestB.onSendData.on(this.sendDataHandler);

            this.requestA.onError.on(this.errorHandler);
            this.requestB.onError.on(this.errorHandler);

            this.rid = this.generateRid();

            this.clientTerminated = false;
            this.sendFuncInterval = this.DEFAULT_SEND_FUNC_INTERVAL;
            this.reconnectIntervalsIndex= -1;
            this.deadTime = null;

            this.getNextHttpWebRequest().execute(this.buildSessionRequestBody().toString());
            this.triggerSendFunction();
        }

        public disconnect(): void {
            this.terminate = true;
        }

        public send(el: XmppXElement | string): void {
            // Bosh should send only XmppXElements
            this.sendQueue.enqueue(<XmppXElement>el);
        }
        //#endregion

        private readDataHandler = (args: WebRequestEventArgs) => {
            this.readDataHandlerFunc(args);
        };
        private readDataHandlerFunc(args: WebRequestEventArgs) {
            // workaround for this problem in lambas
            this.onReadData.trigger(new TextEventArgs(args.data));
            var el = XmppXElement.loadXml(args.data);
            if (el instanceof Xmpp.Bosh.Body)
                this.processBody(el);

            if (this.serverTerminated && this.oneBusy)
                this.onDisconnect.trigger(new EventArgs());
        }
        
        private sendDataHandler = (args: WebRequestEventArgs) => {
            this.sendDataHandlerFunc(args);
        };
        private sendDataHandlerFunc(args: WebRequestEventArgs) {
            // workaround for this problem in lambas
            this.deadTime = null;
            this.onWriteData.trigger(new TextEventArgs(args.data));
        }

        private errorHandler = (args: ExceptionEventArgs) => {
            this.errorHandlerFunc(args);
        };

        private errorHandlerFunc(args: ExceptionEventArgs) {
            // workaround for this problem in lambas
            if (!this.sessionStarted) {
                this.clientTerminated = true;
                this.onError.trigger(args);
                return;
            }

            var now: Date = new Date();
            if (this.deadTime == null)
                this.deadTime = now;
            else {
                var inactive = (now.getTime() - this.deadTime.getTime()) / 1000;
                if (inactive > this.inactivity) {
                    this.clientTerminated = true;
                    this.onDisconnect.trigger(new EventArgs());
                    return;
                }
            }

            if (this.reconnectIntervalsIndex < this.DEFAULT_RECONNECT_INTERVALS.length - 1) {
                this.reconnectIntervalsIndex++;
                this.sendFuncInterval = this.DEFAULT_RECONNECT_INTERVALS[this.reconnectIntervalsIndex];
            }                
        }

        private processBody(body: Body) {
            if (!this.sid) {
                this.sid = body.sid;
                this.sessionStarted = true;
            }

            if (this.inactivity == 0)
                this.inactivity = body.inactivity;

            if (body.type == Type.Terminate) 
                this.serverTerminated = true;
            
            return body
                .elements()
                .where(n => (n instanceof Matrix.Xml.XmppXElement))
                .forEach(
                    (el) => this._xmppClient.xmppStreamParser.onStreamElement.trigger(new StanzaEventArgs(el))
                );
        }

        /* are both requests currently busy? */
        private get bothBusy(): boolean { return this.countBusy === 2 }
        /* is no request busy right now? */
        private get noneBusy() { return this.countBusy === 0; }
        private get oneBusy() { return this.countBusy === 1; }

        private get countBusy() : number{
            var count = 0;
            if (this.requestA.isBusy)
                count++;
            if (this.requestB.isBusy)
                count++;

            return count;
        }

        private getNextHttpWebRequest() : WebRequest
        {
            if (!this.requestA.isBusy)
                return this.requestA;

            if (!this.requestB.isBusy)
                return this.requestB;

            return null;
        }

        //* generates the rid for this session *//
        private generateRid(): number {
            return Crypt.RandomNumberGenerator.create().getNumber(1, this.maxRidToGenerate);
        }

        private buildSessionRequestBody(): Body
        {
            var body = new Body();
            /*
             * <body hold='1' xmlns='http://jabber.org/protocol/httpbind' 
             *  to='vm-2k' 
             *  wait='300' 
             *  rid='782052' 
             *  newkey='8e7d6cec12004e2bfcf7fc000310fda87bc8337c' 
             *  ver='1.6' 
             *  xmpp:xmlns='urn:xmpp:xbosh' 
             *  xmpp:version='1.0'/>
             */

            body.addBoshNameSpace();
            body.addStreamNameSpace();

            body.version = this.BOSH_VERSION;
            //body.xmppVersion = "1.0";

            //body.hold = hold; // do we need that?
            body.wait = this.wait;
            body.rid = this.rid;
            body.polling = 0;

            body.to = new Jid(this._xmppClient.xmppDomain);

            return body;
        }

        private buildBody() {
            this.rid++;
            
            var body = new Body();
            body.addBoshNameSpace();
            body.addStreamNameSpace();

            body.rid = this.rid;
            
            body.sid = this.sid;
            body.to = new Jid(this._xmppClient.xmppDomain);

            if (this.terminate === true) {
                body.type = Type.Terminate;
                this.clientTerminated = true;
            }
            
            if (this.sendQueue.size() > 0) {
                while (this.sendQueue.size() > 0) {
                    var qel = this.sendQueue.dequeue();
                    if (qel instanceof Matrix.Xmpp.Client.Stream)
                        body.xmppRestart = true;
                    else
                        body.add(qel);
                }
            }
            return body;
        }

        /* calcel all WebRequests */
        private cancelRequests() {
            this.requestA.cancel();
            this.requestA.cancel();
        }

        //#region send loop
        sendFunction() {
            if (this.clientTerminated) {
                console.log("stop sendFunction");
                return;
            }
                
            if (this.sendQueue.size() > 0 && !this.bothBusy) {
                console.log("queue: " + this.sendQueue.size() + " have free request, terminate: " + this.terminate);
                this.getNextHttpWebRequest().execute(this.buildBody().toString());
            }
            else if (this.sendQueue.size() == 0 && this.noneBusy && !this.terminate) {
                console.log("queue: " + this.sendQueue.size() + " no active requests, terminate: " + this.terminate);
                this.getNextHttpWebRequest().execute(this.buildBody().toString());
            }
            else if (this.terminate && !this.bothBusy) {
                console.log("queue: " + this.sendQueue.size() + " have free request, terminate: " + this.terminate);
                this.getNextHttpWebRequest().execute(this.buildBody().toString());
            }

            this.triggerSendFunction();
        }

        private triggerSendFunction() {
            setTimeout( () => {
                this.sendFunction();
            }, this.sendFuncInterval);
        }
        //#endregion
    }
} 