/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../xml/XmppXElement.ts" />
/// <reference path="../../Sasl/SaslMechanism.ts" />
module Matrix.Xmpp.Sasl {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;
    import SaslMechanism = Matrix.Sasl.SaslMechanism;

    export class Mechanism extends XmppXElement {
        
        constructor() {
            super(Namespaces.sasl, "mechanism");
        }

        public get saslMechanism(): SaslMechanism {
            return Matrix.Sasl.saslMechanismNameToEnum(this.value);
        }

        public set saslMechanism(value: SaslMechanism) {
            this.value = Matrix.Sasl.enumToSaslMechanismName(value);
        }
    }
}   