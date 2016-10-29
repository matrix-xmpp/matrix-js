/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Crypt/RandomNumberGenerator.ts" />
/// <reference path="../../Util/Functions.ts" />
/// <reference path="../../Crypt/MD5.ts" />
module Matrix.Sasl.Digest {
    "use strict";
    
    export class Step2 {
        private _Cnonce: string;
		private _Nc: string;
		private _DigestUri: string;
		private _Response: string;
		private _Authzid: string;
        
        get cnonce(): string { return this._Cnonce; }
        set cnonce(value: string) { this._Cnonce = value; }

        get nc() { return this._Nc; }
        set nc(value: string) { this._Nc = value; }

        get digestUri(): string { return this._DigestUri; }
        set digestUri(value: string) { this._DigestUri = value; }

        get response(): string { return this._Response; }
        set response(value: string) { this._Response = value; }

        get authzid(): string { return this._Authzid; }
        set authzid(value: string) { this._Authzid = value; }
        
        private _step1: Step1;
        private _proc: SaslProcessor;

        constructor(step1: Step1, proc: SaslProcessor) {
            this._step1 = step1;
            this._proc = proc;

            // fixed for SASL in amessage servers (jabberd 1.x)
            //if (SupportsAuth(step1.Qop))
            //    _step1.Qop = "auth";

            this.generateCnonce();
            this.generateNc();
            this.generateDigestUri();
            this.generateResponse();
        }


        public getMessage() : string{
            return this.generateMessage();
        }	

        private generateCnonce(): void
        {
            // Lenght of the Session ID on bytes,
            // 32 bytes equaly 64 chars
            // 16^64 possibilites for the session IDs (4.294.967.296)
            // This should be unique enough
            var lenght = 32;
            var rng = Crypt.RandomNumberGenerator.create();
        
            var buf = new Array(lenght);
            rng.getBytes(buf);

            this.cnonce = Matrix.Util.Functions.hexToString(buf).toLowerCase();
            //#if TEST
            //    m_Cnonce = "28f47432f9606887d9b727e65db225eb7cb4b78073d8b6f32399400e01438f1e";
            //#endif
        }

        private generateNc() : void {
            this.nc = "00000001";
        }
    
        private generateDigestUri() : void {
            this.digestUri = "xmpp/" + this._proc.server;
        }

        private generateResponse() : void {
            var H1;
            var H2;
            var H3;
           
            var A1: string;
            var A2: string;
            var A3: string;
            
          
            var s = "";
            s += this._proc.username;
            s += ":";
            s += this._step1.realm;
            s += ":";
            s += this._proc.password;

            H1 = Crypt.MD5.hash(s);
            
            //reset s
            s = "";
            s += ":";
            s += this._step1.nonce;
            s += ":";
            s += this.cnonce;

            if (this.authzid != null) {
                s += ":";
                s += this.authzid;
            }

            A1 = s;

            var H1A1 = H1 + A1;
            H1 = Crypt.MD5.hexdigest(H1A1);

            s = "";
            s += "AUTHENTICATE:";
            s += this.digestUri;
            if (this._step1.qop !== "auth") {
                s += ":00000000000000000000000000000000";
            }
            A2 = s;

            H2 = Crypt.MD5.hexdigest(A2);
            
            s = "";
            s += H1;
            s += ":";
            s += this._step1.nonce;
            s += ":";
            s += this.nc;
            s += ":";
            s += this.cnonce;
            s += ":";
            s += this._step1.qop;
            s += ":";
            s += H2;

            A3 = s;

            H3 = Crypt.MD5.hexdigest(A3);

            this.response = H3;
        }

        private generateMessage(): string
        {
            var s = "";
            s += "username=";
            s += this.addQuotes(this._proc.username);
            s += ",";
            s += "realm=";
            s += this.addQuotes(this._step1.realm);
            s += ",";
            s += "nonce=";
            s += this.addQuotes(this._step1.nonce);
            s += ",";
            s += "cnonce=";
            s += this.addQuotes(this.cnonce);
            s += ",";
            s += "nc=";
            s += this.nc;
            s += ",";
            s += "qop=";
            s += this._step1.qop;
            s += ",";
            s += "digest-uri=";
            s += this.addQuotes(this.digestUri);
            s += ",";
            s += "charset=";
            s += this._step1.charset;
            s += ",";
            s += "response=";
            s += this.response;

            return s;
        }

        /// <summary>
        /// return the given string with quotes
        /// </summary>
        /// <param name="s"></param>
        /// <returns></returns>
        private addQuotes(s: string): string {
            // fixed, s can be null (eg. for realm in ejabberd)
            if (s != null && s.length > 0)
                s = s.replace("\\", "\\\\");

            var quote = "\"";
            return quote + s + quote;
        }
    }
}