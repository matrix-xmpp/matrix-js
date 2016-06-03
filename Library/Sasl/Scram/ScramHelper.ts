/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../crypt/sha1.ts" />
/// <reference path="../../crypt/randomnumbergenerator.ts" />
/// <reference path="../../util/base64.ts" />
/// <reference path="../../collections/collections.ts" />
module Matrix.Sasl.Scram {
    "use strict";

    import Dictionary = Collections.Dictionary;
    import RandomNumberGenerator = Crypt.RandomNumberGenerator;
    import Base64 = Matrix.Util.Base64;
    import Sha1 = Matrix.Crypt.SHA1;

    export class ScramHelper {
        private LENGHT_CLIENT_NONCE = 24;
        private LENGHT_SERVER_NONCE = 24;
        private LENGHT_SALT = 20;
        private DEFAULT_ITERATION_COUNT = 4096;

        private firstClientMessage ; string
        private firstServerMessage: string;

        private clientNonceB64: string;
        private serverNonceB64: string;

        generateSalt() : string {
            return RandomNumberGenerator.create().getString(this.LENGHT_SALT);
        }

        /// <summary>
        /// Generate a random client nonce
        /// </summary>
        generateClientNonce(): string {
            var random = RandomNumberGenerator.create().getString(this.LENGHT_CLIENT_NONCE);
            return Base64.encode(random);
        }

        generateServerNonce() : string {
                var random = RandomNumberGenerator.create().getString(this.LENGHT_SERVER_NONCE);
                return Base64.decode(random);
        }

        parseMessage(msg: string): Dictionary<string, string> {
            var str = msg.split(',');

            var dict = new Dictionary<string, string>();

            str.forEach((s: string) => {
                var equalPos: number = s.indexOf("=");
                if (equalPos !== -1) {
                    var key = s.substr(0, equalPos - 0);
                    var val = s.substr(equalPos + 1);

                    if (!dict.containsKey(key))
                        dict.setValue(key, val);
                }
            });
            return dict;
        }

        public hi(pass: string, salt: string, iterations: number) {
            var ssalt = salt + "\x00\x00\x00\x01";
            var U, U_old;

            var Hi = U_old = Sha1.core_hmac_sha1(pass, ssalt);
            for (var i = 1; i < iterations; i++) {
                U = Sha1.core_hmac_sha1(pass, Sha1.binb2str(U_old));
                for (var j = 0; j < 5; j++) {
                    Hi[j] ^= U[j];
                }
                U_old = U;
            }
            return Sha1.binb2str(Hi);
        }

        public generateFirstClientMessage(user: string) : string
        {
            this.clientNonceB64 = this.generateClientNonce();

            var s = "";;

            // no channel bindings supported
            s += "n,,";

            // username
            s += "n=";
            s += this.escapeUsername(user);
            s += ",";

            // client nonce
            s += "r=";
            s += this.clientNonceB64;

            this.firstClientMessage = s;
            return s;
        }

        public generateFinalClientMessage(sMessage: string, password: string) : string
        {
            var pairs = this.parseMessage(sMessage);

            //string clientServerNonce = pairs["r"];
            var serverNonce = pairs.getValue("r").substring(this.clientNonceB64.length);

            var salt = pairs.getValue("s");   // the user's salt - (base64 encoded)
            salt = Base64.decode(salt);
            var iteration = parseInt(pairs.getValue("i"));  // iteation count

            // the bare of our first message
            var clientFirstMessageBare = this.firstClientMessage.substring(3);

            var sb = "";
            sb += "c=biws,";
            // Client/Server nonce
            sb += "r=";
            sb += this.clientNonceB64;
            sb += serverNonce;

            var clientFinalMessageWithoutProof = sb;

            var authMessage = clientFirstMessageBare + "," + sMessage + "," + clientFinalMessageWithoutProof;

            var saltedPassword = this.hi(password, salt, iteration);
            
            var clientKey = Sha1.core_hmac_sha1(saltedPassword, "Client Key");
            var storedKey = Sha1.str_sha1(Sha1.binb2str(clientKey));

            var clientSignature = Sha1.core_hmac_sha1(storedKey, authMessage);
            
            var clientProof = Sha1.binb2str(this.binaryXor(clientKey, clientSignature));

            var clientFinalMessage = clientFinalMessageWithoutProof;
            clientFinalMessage += ",p=";
            clientFinalMessage += Base64.encode(clientProof);

            return clientFinalMessage;
        }
        
        /* binary XOR function */
        private binaryXor(b1, b2) : any[] {
            var result = Array(b1.length);
            for (var k = 0; k < 5; k++) {
                result[k] = b1[k] ^ b2[k];
            }
            return result;
        }

        escapeUsername(user: string): string {
            /*
            The characters ',' or '=' in usernames are sent as '=2C' and
            '=3D' respectively.  If the server receives a username that
            contains '=' not followed by either '2C' or '3D', then the
            server MUST fail the authentication.
            */
            var ret = user.replace(",", "=2C");
            ret = ret.replace("=", "=3D");

            return ret;
        }
    }
} 