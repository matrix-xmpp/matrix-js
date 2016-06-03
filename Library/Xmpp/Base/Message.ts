/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
/// <reference path="../MessageType.ts" />
module Matrix.Xmpp.Base {
    "use strict";
    
    export class Message extends XmppXElementWithAddressAndId {
        constructor(ns: string) {
            super(ns, "message");
        }

        public get type(): MessageType {
             return <MessageType> this.getAttributeEnum("type", MessageType);
        }
        public set type(value: MessageType) {
            if (value === MessageType.Normal)
                this.removeAttribute("type");

            this.setAttributeEnum("type", MessageType, value);
        }
        
        public get body(): string {
            return this.getTag("body");
        }
        public set body(value: string) {
            this.setTag("body", value);
        }

        public get subject(): string {
            return this.getTag("subject");
        }
        public set subject(value: string) {
            this.setTag("subject", value);
        }

        public get delay(): Delay.Delay {
            return this.elementOfType(Delay.Delay);
        }
        public set delay(value: Delay.Delay) {
            this.replace(Delay.Delay, value);
        }
    }
}    