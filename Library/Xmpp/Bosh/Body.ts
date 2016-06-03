/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="Condition.ts" />
/// <reference path="Type.ts" />
/// <reference path="../Base/XmppXElementWithAddress.ts" />
/// <reference path="../../Namespaces.ts" />
/// <reference path="../../Jid.ts" />
module Matrix.Xmpp.Bosh {
     /*
     * <body 
     *  rid='1996404094'
     *  xmlns='http://jabber.org/protocol/httpbind' 
     *  to='anon.ag-software.net'
     *  xml:lang='en'
     *  wait='60'
     *  hold='1'
     *  content='text/xml; charset=utf-8' ver='1.6' 
     *  xmpp:version='1.0' 
     *  xmlns:xmpp='urn:xmpp:xbosh'/>
     */
    import XmppXElementWithAddress = Matrix.Xmpp.Base.XmppXElementWithAddress;
    import XNamespace = Ltxml.XNamespace;
    import XAttribute = Ltxml.XAttribute;

    export class Body extends XmppXElementWithAddress {

        private nsBosh: Ltxml.XNamespace = new XNamespace(Namespaces.xmppXBosh);

        constructor() {
            super(Namespaces.httpBind, "body");
        }

          /// <summary>
        /// Specifies the highest version of the BOSH protocol that the client supports.
        /// The numbering scheme is major.minor (where the minor number MAY be incremented higher than a single digit,
        /// so it MUST be treated as a separate integer).
        /// </summary>
        /// <value>The version.</value>
        /// <remarks>
        /// The version should not be confused with the version of any protocol being transported.
        /// </remarks>
        public get version(): string {
            return this.getAttribute("ver");
        }

        public set version(value: string) {
            this.setAttribute("ver", value);
        }

        public get polling(): number {
            return this.getAttributeNumber("polling");
        }

        public set polling(value: number) {
            this.setAttributeNumber("polling", value);
        }

        public get rid(): number {
            return this.getAttributeNumber("rid");
        }

        public set rid(value: number) {
            this.setAttributeNumber("rid", value);
        }

        public get sid(): string {
            return this.getAttribute("sid");
        }

        public set sid(value: string) {
            this.setAttribute("sid", value);
        }

        public get hold(): number {
            return this.getAttributeNumber("hold");
        }

        public set hold(value: number) {
            this.setAttributeNumber("hold", value);
        }

        public get wait(): number {
            return this.getAttributeNumber("wait");
        }

        public set wait(value: number) {
            this.setAttributeNumber("wait", value);
        }

        public get inactivity(): number {
            return this.getAttributeNumber("inactivity");
        }

        public set inactivity(value: number) {
            this.setAttributeNumber("inactivity", value);
        }
        
        public get xmppVersion(): string {
            return this.getAttribute(this.nsBosh + "version");
        }

        public set xmppVersion(value: string) {
            this.setAttribute(this.nsBosh + "version", value);
        }
        
        public get xmppRestart(): boolean {
            return this.getAttributeBoolean(this.nsBosh + "restart");
        }

        public set xmppRestart(value: boolean) {
            this.setAttributeBoolean(this.nsBosh + "restart", value);
        }
        
        public get type(): Type {
            return <Type> this.getAttributeEnum("type", Type);
        }

        public set type(value: Type) {
            if (value == Type.None)
                this.removeAttribute("type");
            else
                this.setAttributeEnum("type", Type, value);
        }

        public get condition(): Condition {
            return Bosh.conditionToEnum(this.getAttribute("condition"));
        }

        public set condition(value: Condition) {
            if (value == Condition.None)
                this.removeAttribute("condition");
            else
                this.setAttribute("condition", Bosh.enumToCondition(value));
        }
    
        public addBoshNameSpace() : Body {
            this.add(new XAttribute(XNamespace.xmlns + "xmpp", Namespaces.xmppXBosh));
            return this;
        }

        public addStreamNameSpace() : Body
        {
            // xmlns:stream='http://etherx.jabber.org/streams'>
            this.add(new XAttribute(XNamespace.xmlns + "stream", Namespaces.stream));
            return this;
        }
    }
}