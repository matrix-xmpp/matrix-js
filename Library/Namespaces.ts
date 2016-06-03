/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix {
    
    export module Namespaces {
        export var stream          = "http://etherx.jabber.org/streams";
        export var client          = "jabber:client";
        export var server          = "jabber:server";
        export var serverDialback = "jabber:server:dialback";

        export var featureIqRegister = "http://jabber.org/features/iq-register";

        /// <summary>Sasl (urn:ietf:params:xml:ns:xmpp-sasl)</summary>
        export var sasl = "urn:ietf:params:xml:ns:xmpp-sasl";

        /// <summary>Bind (urn:ietf:params:xml:ns:xmpp-bind)</summary>
        export var bind = "urn:ietf:params:xml:ns:xmpp-bind";

        /// <summary>Session (urn:ietf:params:xml:ns:xmpp-session)</summary>
        export var session = "urn:ietf:params:xml:ns:xmpp-session";

        /// <summary>
        /// jabber:iq:roster
        /// </summary>
        export var iqRoster = "jabber:iq:roster";

        export var httpBind = "http://jabber.org/protocol/httpbind";
        export var xmppXBosh = "urn:xmpp:xbosh";

        /* websocket framing urn:ietf:params:xml:ns:xmpp-framing */
        export var framing = "urn:ietf:params:xml:ns:xmpp-framing";

        /// <summary>XEP-0203: Delayed Delivery (urn:xmpp:delay)</summary>
        export var delay = "urn:xmpp:delay";

        // Muc
        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc)</summary>
        export var muc = "http://jabber.org/protocol/muc";

        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc#user)</summary>
        export var mucUser = "http://jabber.org/protocol/muc#user";

        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc#admin)</summary>
        export var mucAdmin = "http://jabber.org/protocol/muc#admin";

        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc#owner)</summary>
        export var mucOwner = "http://jabber.org/protocol/muc#owner";

        /// <summary>(jabber:x:conference)</summary>
        export var xConference = "jabber:x:conference";
    }
}  