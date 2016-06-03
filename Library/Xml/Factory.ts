/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Collections/Collections.ts" />
/// <reference path="XmppXElement.ts" />
module Matrix.Xml.Factory {
    "use strict";

    import Dictionary = Collections.Dictionary;

    //var _dict = new Dictionary<string, string>();

    var _dict = new Dictionary<string, { new (): XmppXElement; }>();

    var isFactoryInitialized = false;
    
    //XmppXElement>(typee: { new (): T; }) 
    function buildKey(ns: string, localName: string): string
    {
        return "{" + ns + "}" + localName;
    }

    export function create<T>(c: { new (): T; }): T {
        return new c();
    }
   
    /*
    export function create(className: string) {
        var arr = className.split(".");
        
        // windows is global in node.js
        var fn: any = window;
        for (var i = 0, len = arr.length; i < len; i++) {
            fn = fn[arr[i]];
        }
        //var newInstance = Object.create(window["Matrix"]["Xmpp"]["Client"]["Message"].prototype);
        var newInstance = Object.create(fn.prototype);
        newInstance.constructor.apply(newInstance);
        return newInstance;
    }
      
    export function registerElement(ns: string, tagname: string, clazz: string) {
        var key = buildKey(ns, tagname);
        //var clazzType = typeof clazz;
        
        _dict.setValue(key, clazz);
    }
    */

    export function registerElement<T extends XmppXElement>(ns: string, tagname: string, el: { new (): T; }) {
        var key = buildKey(ns, tagname);
        _dict.setValue(key, el);
    }

    function initFactory() {
        // stream client
        registerElement(Namespaces.stream, "strea,", Matrix.Xmpp.Client.Stream);
        // stream features
        registerElement(Namespaces.stream, "features", Matrix.Xmpp.Stream.StreamFeatures);
        registerElement(Namespaces.featureIqRegister, "register", Matrix.Xmpp.Stream.Features.Register);

        registerElement(Namespaces.sasl, "mechanism", Matrix.Xmpp.Sasl.Mechanism);
        registerElement(Namespaces.sasl, "mechanisms", Matrix.Xmpp.Sasl.Mechanisms);
        registerElement(Namespaces.sasl, "auth", Matrix.Xmpp.Sasl.Auth);
        registerElement(Namespaces.sasl, "challenge", Matrix.Xmpp.Sasl.Challenge);
        registerElement(Namespaces.sasl, "response", Matrix.Xmpp.Sasl.Response);
        registerElement(Namespaces.sasl, "success", Matrix.Xmpp.Sasl.Success);
        registerElement(Namespaces.sasl, "failure", Matrix.Xmpp.Sasl.Failure);

        registerElement(Namespaces.bind, "bind", Matrix.Xmpp.Bind.Bind);
        registerElement(Namespaces.session, "session", Matrix.Xmpp.Session.Session);

        registerElement(Namespaces.client, "iq", Matrix.Xmpp.Client.Iq);
        registerElement(Namespaces.client, "presene", Matrix.Xmpp.Client.Presence);
        registerElement(Namespaces.client, "message", Matrix.Xmpp.Client.Message);

        registerElement(Namespaces.iqRoster, "item", Matrix.Xmpp.Roster.RosterItem);
        registerElement(Namespaces.iqRoster, "query", Matrix.Xmpp.Roster.Roster);

        registerElement(Namespaces.httpBind, "body", Matrix.Xmpp.Bosh.Body);

        // websocket framing
        registerElement(Namespaces.framing, "open", Matrix.Xmpp.Framing.Open);
        registerElement(Namespaces.framing, "close", Matrix.Xmpp.Framing.Close);

        registerElement(Namespaces.delay, "delay", Matrix.Xmpp.Delay.Delay);

        // MUC
        registerElement(Namespaces.muc, "history", Matrix.Xmpp.Muc.History);
        registerElement(Namespaces.muc, "x", Matrix.Xmpp.Muc.X);
        //registerElement(Namespaces.muc, "item", Matrix.Xmpp.Muc.Item);
        registerElement(Namespaces.xConference, "x", Matrix.Xmpp.Muc.Conference);
        registerElement(Namespaces.mucUser, "status", Matrix.Xmpp.Muc.User.Status);
        registerElement(Namespaces.mucUser, "continue", Matrix.Xmpp.Muc.User.Continue);
        registerElement(Namespaces.mucUser, "actor", Matrix.Xmpp.Muc.User.Actor);


        isFactoryInitialized = true;
    }

    /*
    export function getElement(prefix: string, localName: string, ns: string): XmppXElement {
        if (!isFactoryInitialized)
            initFactory();

        var key = buildKey(ns, localName);
        if (_dict.containsKey(key)) {
            var clazz = _dict.getValue(key);
            return create(clazz);
        }

        return new XmppXElement(ns, localName);
    }
    */

    export function getElement(prefix: string, localName: string, ns: string): XmppXElement {
        if (!isFactoryInitialized)
            initFactory();

        var key = buildKey(ns, localName);
        if (_dict.containsKey(key)) {
            var clazz = _dict.getValue(key);
            return create(clazz);
        }

        return new XmppXElement(ns, localName);
    }
}