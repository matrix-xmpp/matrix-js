/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="util/functions.ts" />
module Matrix {
    import Functions = Matrix.Util.Functions;

    export class Jid {
        _node: string = null;
        _domain: string = null;
        _resource: string = null;

        public constructor(jid: string) {
            if (!Functions.isUndefined(jid)) {
                this._node = this.getNodeFromJid(jid);
                this._domain = this.getDomainFromJid(jid);
                this._resource = this.getResourceFromJid(jid);
            }
        }

        public get node(): string { return this._node; }
        public set node(value: string) { this._node = value; }

        public get domain(): string { return this._domain; }
        public set domain(value: string) { this._domain = value; }

        public get resource(): string { return this._resource; }
        public set resource(value: string) { this._resource = value; }

        public get bare(): string { return this.getBare(); }

        public get full(): string { return this.getFull(); }

        public toString(): string {
            return this.getFull();
        }

        getBare(): string {
            var s: string = "";
            if (this._node != null)
                s = s + this._node;

            if (this._domain != null) {
                if (s.length > 0)
                    s += "@";

                s += this._domain;
            }
            return s;
        }

        getFull() {
            var s: string = this.getBare();
            if (this._resource != null && s.length > 0)
                s += "/" + this._resource;

            return s;
        }

        getBareJidFromJid(jid: string): string {
            return jid ? jid.split("/")[0] : null;
        }

        getResourceFromJid(jid: string): string {
            var s = jid.split("/");
            if (s.length < 2) {
                return null;
            }
            s.splice(0, 1);
            return s.join('/');
        }

        getDomainFromJid(jid: string): string {
            var bare = this.getBareJidFromJid(jid);
            if (bare.indexOf("@") < 0) {
                return bare;
            } else {
                var parts = bare.split("@");
                parts.splice(0, 1);
                return parts.join('@');
            }
        }

        getNodeFromJid(jid: string): string {
            if (jid.indexOf("@") < 0) {
                return null;
            }
            return jid.split("@")[0];
        }

        public clone(): Jid {
            return new Jid(this.full);
        }
    }
}