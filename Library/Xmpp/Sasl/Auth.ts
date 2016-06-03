/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Sasl/SaslMechanism.ts" />
/// <reference path="../Base/Sasl.ts" />
module Matrix.Xmpp.Sasl {
    "use strict";

    import SaslMechanism = Matrix.Sasl.SaslMechanism;

    export class Auth extends Base.Sasl {
        constructor(saslMechanism?: SaslMechanism, value?: string) {
            super("auth");
            
            if (!Util.Functions.isUndefined(saslMechanism))
                this.saslMechanism = saslMechanism;

            if (!Util.Functions.isUndefined(value))
                this.value = value;
        }
        
        public get saslMechanism(): SaslMechanism {
            var name = this.getAttribute("mechanism");
            return Matrix.Sasl.saslMechanismNameToEnum(name);
        }

        public set saslMechanism(value: SaslMechanism) {
            this.setAttribute("mechanism", Matrix.Sasl.enumToSaslMechanismName(value));
        }
    }
}     