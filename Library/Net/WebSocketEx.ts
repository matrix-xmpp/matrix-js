/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Xml/XmppXElement.ts" />
/// <reference path="ISocket.ts" />
module Matrix.Net {
    import XmppXElement = Matrix.Xml.XmppXElement;

    export class WebSocketEx implements ISocket {

        public onReadData = new Matrix.GenericEvent<TextEventArgs>();
        public onWriteData = new Matrix.GenericEvent<TextEventArgs>();
        public onConnect = new Matrix.GenericEvent<EventArgs>();
        public onDisconnect = new Matrix.GenericEvent<EventArgs>();
        public onError = new GenericEvent<ExceptionEventArgs>();

        private _xmppClient: XmppClient;
        private webSocket: WebSocket;

        constructor(xmppClient: XmppClient){
            this._xmppClient = xmppClient;
        }

        public connect(): void {
            //var url = Util.Functions.textFormat(this.WEBSOCKET_URI_TPL, this.hostname, this.port);
            this.webSocket = new WebSocket(this._xmppClient.uri, 'xmpp');

            this.webSocket.onerror = () => {
                console.log('Websocket onerror');
            };
            this.webSocket.onopen = () => {
                this.onConnect.trigger(new EventArgs());
            };
            this.webSocket.onclose = () => {
                this.onDisconnect.trigger(new EventArgs());
            };
            this.webSocket.onmessage = e => {
                console.log("RECV: " + e.data);
                this.onReadData.trigger(new TextEventArgs(e.data));
            };
        }

        public disconnect(): void {
            this.webSocket.close();
        }

        public send(data: XmppXElement | string) : void {
            var toSend: string;
            if (typeof data === 'string')
                toSend = data;
            else
                toSend = data.toString();
            
            console.log("RECV: " + toSend);
            this.webSocket.send(toSend);
            this.onWriteData.trigger(new TextEventArgs(toSend));
        }
    }
}