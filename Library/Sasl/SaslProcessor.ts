/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Sasl {
    import Challenge = Matrix.Xmpp.Sasl.Challenge;
    "use strict";

    export class SaslProcessor {
        private _xmppClient: XmppClient;
        private _server: string;
        private _username: string;
        private _password: string;

        public get xmppClient(): XmppClient { return this._xmppClient; }

        get server(): string { return this._server.toLowerCase(); }
        set server(value: string) { this._server = value; }

        get username(): string { return this._username; }
        set username(value: string) { this._username = value; }

        get password(): string { return this._password; }
        set password(value: string) { this._password = value; }
        
        public init(xmppClient: XmppClient): void {
            this._xmppClient = xmppClient;
        }
        
        public parse(ch:Challenge): void {
        
        }
    }
}