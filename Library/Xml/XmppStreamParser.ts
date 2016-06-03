/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Events.ts" />
/// <reference path="../EventArgs.ts" />
/// <reference path="../Typings/ltxml.d.ts" />
/// <reference path="../Typings/sax.d.ts" />
/// <reference path="../StanzaEventArgs.ts" />
/// <reference path="../ExceptionEventArgs.ts" />
module Matrix.Xml {
    "use strict";

    import GenericEvent = Matrix.GenericEvent;
    
    export class XmppStreamParser
    {
        //// stream header received
        public onStreamStart = new GenericEvent<StanzaEventArgs>();
        //// xmpp stanza/element received
        public onStreamElement = new GenericEvent<StanzaEventArgs>();
        //// stream footer received
        public onStreamEnd = new GenericEvent<EventArgs>();
        //// sEvent for XML  errors
        public onStreamError = new GenericEvent<ExceptionEventArgs>();
        //  Event for general errors
        public onError = new GenericEvent<ExceptionEventArgs>();

        _depth = 0;
        //_nsStack = new NamespaceStack();  
        _root: XmppXElement;
        _current: XmppXElement;      
        _parser: sax.SAXParser;

        saxOpts: sax.SAXOptions = {
            lowercase: true,
            normalize: true,
            xmlns: true,
            position: true
        };

        constructor() {
            this.initParser();
        }

        public reset(): void { 
            this.initParser();
        }

        private initParser() {
            this._depth = 0;
            this._root = null;
            this._current = null;

            this._parser = null;
            this._parser = new sax.SAXParser(/*strict=*/true, this.saxOpts);

            this._parser.onerror = (e: Error) => {
                this.onStreamError.trigger(new ExceptionEventArgs(e.message));
                //console.log("onerror: " + e);
            };

            this._parser.ontext = (text: string) => {
                //console.log("ontext: " + text);
                this._current.add(new Ltxml.XText(text));
            };

            this._parser.onopentag = (tag: sax.Tag) => {
                this._depth++;
                //this._nsStack.push();

                var newel = Factory.getElement(tag.prefix, tag.local, tag.uri);
                for (var key in tag.attributes) {
                    var attr = tag.attributes[key];
                    //newel.setAttribute(attr.name, attr.value);

                    var ns: Ltxml.XNamespace;
                    var xn: Ltxml.XName;

                    if (attr.uri === "" && attr.prefix !== "xmlns") {
                        if (attr.prefix === "xml") {
                            ns = Ltxml.XNamespace.getXml();
                        } else {
                            ns = Ltxml.XNamespace.getNone();
                        }
                    } else {
                        if (attr.uri === "http://www.w3.org/2000/xmlns/" ||
                            attr.prefix === "xmlns") {
                            ns = Ltxml.XNamespace.getXmlns();
                        } else if (attr.uri === "http://www.w3.org/XML/1998/namespace") {
                            ns = Ltxml.XNamespace.getXml();
                        } else {
                            ns = new Ltxml.XNamespace(
                                attr.uri,
                                attr.prefix ? attr.prefix.toString() : null);
                        }
                    }

                    if (attr.local) {
                        xn = new Ltxml.XName(ns, attr.local);
                    } else {
                        if (attr.name === "xmlns") {
                            xn = new Ltxml.XName(ns, "xmlns");
                        } else {
                            xn = new Ltxml.XName(ns, attr.name /* node.baseName*/);
                        }
                    }

                    newel.add(new Ltxml.XAttribute(xn, attr.value));
                }

                if (this._root == null) {
                    this._root = newel;

                    this.onStreamStart.trigger(new StanzaEventArgs(this._root));
                    //console.log("raise DoRaiseOnStreamStart");
                }
                else {
                    if (this._current != null)
                        this._current.add(newel);

                    this._current = newel;
                }
            };

            this._parser.onclosetag = (tagname: string) => {
                this._depth--;
                
                if (this._current == null) {
                    this.onStreamEnd.trigger();
                    return;
                }

                var parent = <XmppXElement> this._current.parent;
                if (parent == null) {
                    this.onStreamElement.trigger(new StanzaEventArgs(this._current));
                }

                this._current = parent;
            };


            //this._parser.onattribute = (attr: { name: string; value: string; }) => {
            //    console.log("onattribute: " + attr.name + " \ " + attr.value);
            //};

            this._parser.onend = () => {
                //console.log("onend");
            };
        }

        //public get depth(): number { return this._depth; }

        public write(data: string) {
            this._parser.write(data);
        }
    }
} 