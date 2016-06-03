/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Base/XmppXElementWithAddress.ts" />
/// <reference path="../../Namespaces.ts" />
/// <reference path="../../Jid.ts" />
/// <reference path="../../Util/Time.ts" />
module Matrix.Xmpp.Delay {
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
    import Time = Matrix.Util.Time;

    export class Delay extends XmppXElementWithAddress {

        constructor() {
            super(Namespaces.delay, "delay");
        }

        public get stamp(): number {
            return this.getAttributeIso8601Date("stamp");
        }
        public set stamp(value: number) {
            this.setAttributeIso8601Date("stamp", value);
        }
    }
} 