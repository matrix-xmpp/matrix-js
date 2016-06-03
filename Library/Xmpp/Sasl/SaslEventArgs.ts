/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../EventArgs.ts" />
/// <reference path="../../Sasl/SaslMechanism.ts" />
/// <reference path="../../Sasl/SaslProcessor.ts" />
module Matrix.Xmpp.Sasl {

    "use strict";

    import SaslMechanism = Matrix.Sasl.SaslMechanism;
    import SaslProcessor = Matrix.Sasl.SaslProcessor;

    export class SaslEventArgs extends EventArgs {
        _auto: boolean;
        _mechanisms: Mechanisms;
        _saslMechanism: SaslMechanism;
        _customSaslProcessor: SaslProcessor;
        _failure: Failure;

        constructor(failure?: Failure) {
            super();
            if (failure)
                this._failure = failure;
        }

        /// <summary>
        /// Should the library automatically choose the most appropriate SASL mechanism?
        /// When set to false you have to specify the SASL mechanism manual.
        /// </summary>
        public get auto(): boolean { return this._auto; }
        public set auto(value: boolean) { this._auto = value; }

        public get mechanisms(): Mechanisms { return this._mechanisms; }
        public set mechanisms(value: Mechanisms) { this._mechanisms = value; }

        public get saslMechanism(): SaslMechanism { return this._saslMechanism; }
        public set saslMechanism(value: SaslMechanism) { this._saslMechanism = value; }

        public get customSaslProcessor(): SaslProcessor { return this._customSaslProcessor; }
        public set customSaslProcessor(value: SaslProcessor) { this._customSaslProcessor = value; }

        public get failure(): Failure { return this._failure; }
        public set failure(value: Failure) { this._failure = value; }
    }
}