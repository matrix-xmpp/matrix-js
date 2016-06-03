/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../Sasl/Mechanisms.ts" />
module Matrix.Xmpp.Stream {
    "use strict";

    import XmppXElement = Matrix.Xml.XmppXElement;
    import Mechanisms = Matrix.Xmpp.Sasl.Mechanisms;

    export class StreamFeatures extends XmppXElement {
        constructor() {
            super(Namespaces.stream, "features", "stream");
        }

        /// <summary>
        /// Sasl mechanisms stream feature
        /// </summary>
        public get mechanisms(): Mechanisms { return this.elementOfType(Mechanisms); }

        /// <summary>
        /// Is resource binding supported?
        /// </summary>
        public get supportsBind() : boolean { return this.hasElementOfType(Matrix.Xmpp.Bind.Bind)}
       
        public get supportsSession(): boolean { return this.hasElementOfType(Matrix.Xmpp.Bind.Bind) }

    }
} 