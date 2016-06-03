/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
/// <reference path="../Show.ts" />
/// <reference path="../PresenceType.ts" />
module Matrix.Xmpp.Base {
    "use strict";
    
    export class Presence extends XmppXElementWithAddressAndId {
        constructor(ns: string) {
            super(ns, "presence");
        }

        public get type(): PresenceType {
            var presType = this.getAttribute("type");
            if (presType == null)
                return PresenceType.Available;
            else
                return Matrix.Util.Enum.parse(PresenceType, presType);
        }
        public set type(value: PresenceType) {
            if (value == PresenceType.Available)
                this.removeAttribute("type");

            this.setAttribute("type", Matrix.Util.Enum.toString(PresenceType, value));
        }

        public get show(): Show {
            if (this.hasTag("show"))
                return showNameToEnum(this.getTag("show"));

            return Show.None;
        }
        public set show(value: Show) {
            if (value == Show.None)
                this.removeTag("show");
            else
                this.setTag("show", enumToShowName(value));
        }

        public get priority(): number {
            if (this.hasTag("priority"))
                return parseInt(this.getTag("priority"));

            return 0;
        }
        public set priority(value: number) {
             this.setTag("priority", value.toString());
        }

        public set status(value: string) {
            this.setTag("status", value);
        }
        public get status(): string {
            return this.getTag("status");
        }
    }
}     