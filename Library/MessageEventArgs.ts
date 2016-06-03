/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="EventArgs.ts" />
/// <reference path="Xmpp/Client/Message.ts" />
module Matrix {
    
    "use strict";

    import Message = Matrix.Xmpp.Client.Message;

    export class MessageEventArgs extends EventArgs  {
        private _message: Message;

        constructor(message: Message) {
            super();
            this.message = message;
        }

        public get message(): Message { return this._message; }
        public set message(value: Message) { this._message = value; }
    }
}  