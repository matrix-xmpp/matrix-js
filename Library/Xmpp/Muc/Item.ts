/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/Item.ts" />
module Matrix.Xmpp.Muc {
    "use strict";
    export class Item extends Base.Item {
        constructor(ns: string) {
            super(ns);
        } 

        public get role(): Role {
            return <Role> this.getAttributeEnum("role", Role);
        }
        public set type(value: Role) {
            this.setAttributeEnum("role", Role, value);
        }

        public get affiliation(): Affiliation {
            return <Affiliation> this.getAttributeEnum("affiliation", Affiliation);
        }
        public set affiliation(value: Affiliation) {
            this.setAttributeEnum("affiliation", Affiliation, value);
        }

        public get nick(): string {
            return this.getAttribute("nick");
        }
        public set nick(value: string) {
            this.setAttribute("nick", value);
        }

        public get reason(): string {
            return this.getTag("reason");
        }
        public set reason(value: string) {
            this.setTag("reason", value);
        }
    }
} 