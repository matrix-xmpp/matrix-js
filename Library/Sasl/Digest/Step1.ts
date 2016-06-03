/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Sasl.Digest {

    "use strict";

    export class Step1 {
        private _Realm: string = "";
        private _Nonce: string;
        private _Qop: string;
        private _Charset: string = "utf-8";
        private _Algorithm: string;
        private _Rspauth: string = null;


        get realm() :string { return this._Realm; }
        set realm(value: string) { this._Realm = value; }

        get nonce() { return this._Nonce; }
        set nonce(value: string) { this._Nonce = value; }

        get qop(): string  { return this._Qop; }
        set qop(value: string) { this._Qop = value; }

        get charset(): string  { return this._Charset; }
        set charset(value: string) { this._Charset = value; }

        get algorithm(): string  { return this._Algorithm; }
        set algorithm(value: string) { this._Algorithm = value; }

        get rspauth(): string  { return this._Rspauth; }
        set rspauth(value: string) { this._Rspauth = value; }

        constructor(s: string) {
            this.parse(s);
        }

        /*
            nonce="deqOGux/N6hDPtf9vkGMU5Vzae+zfrqpBIvh6LovbBM=",
            realm="amessage.de",
            qop="auth,auth-int,auth-conf",
            cipher="rc4-40,rc4-56,rc4,des,3des",
            maxbuf=1024,
            charset=utf-8,
            algorithm=md5-sess
        */
        parse(message: string): void {
            try {
                var start: number = 0;
                while (start < message.length) {
                    var equalPos: number = message.indexOf('=', start);
                    if (equalPos > 0) {
                        // look if the next char is a quote
                        var end: number;
                        if (message.substr(equalPos + 1, 1) === "\"") {
                            // quoted value, find the end now
                            end = message.indexOf('"', equalPos + 2);
                            this.parsePair(message.substr(start, end - start + 1));
                            start = end + 2;
                        } else {
                            // value is not quoted, ends at the next comma or end of string   
                            end = message.indexOf(',', equalPos + 1);
                            if (end === -1)
                                end = message.length;

                            this.parsePair(message.substr(start, end - start));

                            start = end + 1;
                        }
                    }
                }

            } catch (e) {

            }
        }

        parsePair(pair: string): void {
            var equalPos: number = pair.indexOf("=");
            if (equalPos > 0) {
                var key: string = pair.substr(0, equalPos);
                // is the value quoted?

                var data: string = pair.substr(equalPos + 1, 1) === "\""
                    ? pair.substr(equalPos + 2, pair.length - equalPos - 3)
                    : pair.substr(equalPos + 1);

                switch (key) {
                case "realm":
                    this.realm = data;
                    break;
                case "nonce":
                    this.nonce = data;
                    break;
                case "qop":
                    this.qop = data;
                    break;
                case "charset":
                    this.charset = data;
                    break;
                case "algorithm":
                    this.algorithm = data;
                    break;
                case "rspauth":
                    this.rspauth = data;
                    break;
                }
            }
        }
    }
}