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

    export class Mechanisms extends XmppXElement {
        constructor() {
            super(Namespaces.sasl, "mechanisms");
        }

        public getMechanisms(): linqjs.Enumerable {
            return this.elementsOfType(Mechanism);
        }

        public supportsMechanism(mech: SaslMechanism): boolean {
            return this.getMechanisms().any(
                n => (n.saslMechanism === mech)
            );
        }

        public getMechanism(mech: SaslMechanism) : Mechanism {
            return this.getMechanisms()
                .firstOrDefault(n => n.saslMechanism === mech);
        }
    }
}   