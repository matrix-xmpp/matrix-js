/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../Typings/ltxml.d.ts" />
/// <reference path="../Util/Enum.ts" />
/// <reference path="../Util/Time.ts" />
module Matrix.Xml {
    "use strict";

    import XAttribute = Ltxml.XAttribute;
    import XElement = Ltxml.XElement;
    import XNamespace = Ltxml.XNamespace;
    import Enum = Matrix.Util.Enum;

    export class XmppXElement extends XElement {
        constructor(ns: string, tagname: string, prefix?: string)
        {
            super("{" + ns + "}" + tagname);

            if (prefix)
                this.add(new XAttribute(XNamespace.xmlns + prefix, ns));
        }

        public toString(indent: boolean = false) : string {
            return super.toString(indent);
        }

        public startTag() : string {
            var xml = this.toString();
            xml = xml.replace("/>", ">");
            var idx = xml.indexOf(">");
            return xml.substring(0, idx+1);
        }

        public endTag() : string  {
            var xml = this.toString();
            var spacePos = xml.indexOf(" ");
            return "</" + xml.substr(1, spacePos - 1) + ">";
        }

        public getAttribute(attname: string): string {
            if (this.hasAttribute(attname))
                return this.attribute(attname).value;
            
            return null;
        }

        public hasAttribute(attname: string): boolean {
            var att = this.attribute(attname);
            return (att !== null);
        }

        public setAttribute(attname: string, val: string) : XmppXElement {
            this.setAttributeValue(attname, val);
            return this;
        }

        public removeAttribute(attname: string): XmppXElement {
            this.setAttributeValue(attname, null);
            return this;
        }

        public setAttributeEnum(attname: string, e: any, eVal: any) : XmppXElement {
            this.setAttributeValue(attname, Enum.toString(e, eVal).toLocaleLowerCase());
            return this;
        }

        public getAttributeEnum(attname: string, e: any): any {
            if (this.hasAttribute(attname)) {
                var attValue = this.attribute(attname).value;
                return Enum.parse(e, attValue);
            }
            return -1;
        }

        public getAttributeBoolean(name: string): boolean {
            if (this.hasAttribute(name)) {
                var val = this.getAttribute(name);

                if (val === "true" || val === "1")
                    return true;
            }
            return false;
        }

        public setAttributeBoolean(name: string, val: boolean) : XmppXElement
        {            
            this.setAttribute(name, val ? "true" : "false");
            return this;
        }

        public getAttributeNumber(name): number {
            try {
                if (this.hasAttribute(name)) {
                    var val = this.getAttribute(name);

                    return parseInt(val);
                }
                return 0;

            } catch (e) {
                return 0;
            }
        }

        public setAttributeNumber(attname: string, val: number): XmppXElement {
            this.setAttribute(attname, val.toString());
            return this;
        }

        public setAttributeIso8601Date(attname: string, val: number): XmppXElement {
            var dt = new Date(val);
            this.setAttribute(attname, dt.toISOString());
            return this;
        }
        public getAttributeIso8601Date(attname: string) : number {
            return Util.Time.Iso8601Date(this.getAttribute(attname));
        }
      
        public getAttributeJid(attname: string): Jid {
            if (this.hasAttribute(attname)) {
                var attValue = this.attribute(attname).value;
                return new Jid(attValue);
            }
            return null;
        }

        public setAttributeJid(attname: string, jid: Jid): XmppXElement {
            this.setAttributeValue(attname, jid.toString());
            return this;
        }

        public getFirstXmppXElement(): XmppXElement {
            return this
                .elements()
                .firstOrDefault(n => (n instanceof Matrix.Xml.XmppXElement)
                );
        }

        public get firstXmppXElement(): XmppXElement {
            return this.getFirstXmppXElement();
        }

        public elementOfType<T extends Ltxml.XElement>(typee: { new (): T; }): T {
            return this
                .elements()
                .firstOrDefault(n => (n instanceof typee)
                );
        }

        public elementsOfType<T extends Ltxml.XElement>(typee: { new (): T; }) : linqjs.Enumerable {
            return this
                .elements()
                .where(n => (n instanceof typee)
                );
        }

        public getValueFromBase64() {
            return Matrix.Util.Base64.decode(this.value);
        }

        public setValueFromBase64(value: string) {
            this.value = Matrix.Util.Base64.encode(value);
        }

        public getTag(tagname: string): string {
            var ns = this.name.namespaceName;
            var child = this.element("{" + ns + "}" + tagname);
            if (child != null)
                return child.value;
            
            return null;
        }

        public hasElementOfType<T extends XmppXElement>(typee: { new (): T; }) : boolean {
            return this.elementOfType(typee) != null;
        }

        public hasTag(tagname: string): boolean {
            return this.getTag(tagname) != null;
        }

        public getTagJid(tagname: string): Jid {
            var val = this.getTag(tagname);
            if (val != null)
                return new Jid(val);

            return null;
        }

        public removeTag(tagname: string): void {
            var ns = this.name.namespaceName;
            var el = this.element("{" + ns + "}" + tagname);
            if (el != null)
                el.remove();
        }

        public setTag(tagname: string, value: string): XmppXElement {
            var ns = this.name.namespaceName;
            this.add(new XElement("{" + ns + "}" + tagname, value));

            return this;
        }

        public replace<T extends XmppXElement>(clazz: { new (): T; }, value: T) {
            var el = this.elementOfType(clazz);
            if (el != null)
                el.remove();

            this.add(value);
        }
       
        // load using the streamparser and sax.js
        public static loadXml(xml : string): XmppXElement {
            var el: XmppXElement = null;
            var sp = new XmppStreamParser();
            sp.onStreamElement.on((args: Matrix.StanzaEventArgs) => {
                el = args.stanza;
            });
            sp.write("<a>" + xml + "</a>");
            return el;
        }
        
        //#region domloader
        //import XName = Ltxml.XName;
        //import XNode = Ltxml.XNode;
        //import AddContentThatCanContainEntities = Ltxml.addContentThatCanContainEntities;
        //import Functions = Matrix.Util.Functions;
        //public static loadXml2(xml: string): XmppXElement {
        //    var doc = this.parseXml(xml);
        //    return this.treeWalk(doc);  
        //}

        //private static parseXml(xmlStr) {
        //    var domParser;

        //    // If there is a BOM at the beginning of the XML, then remove it.  The DOMParser in Chrome (V8 browser)
        //    // does not process the BOM correctly.  The BOM is processed correctly by the IE Chakra engine, as well
        //    // as the DOMParser in NodeJS.
        //    if (xmlStr.charCodeAt(0) === 0xFEFF) {
        //        xmlStr = xmlStr.substring(1);
        //    }

        //    if (typeof DOMParser !== "undefined") {
        //        domParser = (new DOMParser()).parseFromString(xmlStr, "application/xml");
        //        return domParser;
        //    } else if (typeof ActiveXObject !== "undefined" &&
        //        new ActiveXObject("Microsoft.XMLDOM")) {
        //        var xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        //        xmlDoc.async = "false";
        //        xmlDoc.loadXML(xmlStr);
        //        return xmlDoc;
        //    } else {
        //        throw new Error("No XML parser found");
        //    }
        //}

        /*            
            NodeType	Named Constant
            1	ELEMENT_NODE
            2	ATTRIBUTE_NODE
            3	TEXT_NODE
            4	CDATA_SECTION_NODE
            5	ENTITY_REFERENCE_NODE
            6	ENTITY_NODE
            7	PROCESSING_INSTRUCTION_NODE
            8	COMMENT_NODE
            9	DOCUMENT_NODE
            10	DOCUMENT_TYPE_NODE
            11	DOCUMENT_FRAGMENT_NODE
            12	NOTATION_NODE
        */
        //private static treeWalk(this_node, curEl?: XmppXElement) : XmppXElement {
        //    var nodes;
        //    if (this_node.childNodes) // *** this node has children
        //    {
        //        nodes = this_node.childNodes;
        //        //this.loopChildren(nodes, curEl);
        //        var node;
        //        for (var i = 0; i < nodes.length; i++) {
        //            node = nodes[i];
        //            curEl = this.processNode(node, curEl);
        //            if (node.childNodes.length > 0)
        //                curEl = this.treeWalk(node, curEl);
        //        }
        //        if (curEl.parent != null)
        //            curEl = curEl.parent;
        //    }
        //    return curEl;
        //}

        //private static loopChildren(nodes, curEl: XmppXElement) : XmppXElement {
        //    var node;
        //    for (var i = 0; i < nodes.length; i++) {
        //        node = nodes[i];
        //        curEl = this.processNode(node, curEl);
        //        if (node.childNodes)
        //            curEl = this.treeWalk(node, curEl); // this is the recursion
        //        //   if a child has children we must process
        //        //   the children (all of them) before we
        //        //   proceed to the next 
        //    }
        //    return curEl;
        //}

        //private static processAttribute(node): Ltxml.XAttribute {
        //    var ns;
        //    var xn;

        //    if (node.namespaceURI === null || node.namespaceURI === undefined ||
        //    (node.namespaceURI === "" && node.prefix !== "xmlns")) {
        //        if (node.prefix === "xml") {
        //            ns = Ltxml.XNamespace.getXml();
        //        } else {
        //            ns = Ltxml.XNamespace.getNone();
        //        }
        //    } else {
        //        if (node.namespaceURI === "http://www.w3.org/2000/xmlns/" ||
        //            node.prefix === "xmlns") {
        //            ns = Ltxml.XNamespace.getXmlns();
        //        } else if (node.namespaceURI ===
        //            "http://www.w3.org/XML/1998/namespace") {
        //            ns = Ltxml.XNamespace.getXml();
        //        } else {
        //            ns = new Ltxml.XNamespace(
        //                node.namespaceURI,
        //                node.prefix ?
        //                node.prefix.toString() :
        //                null);
        //        }
        //    }
        //    if (node.localName) {
        //        xn = new Ltxml.XName(ns, node.localName);
        //    } else {
        //        if (node.nodeName === "xmlns") {
        //            xn = new Ltxml.XName(ns, "xmlns");
        //        } else {
        //            xn = new Ltxml.XName(ns, node.baseName);
        //        }
        //    }
        //    return new Ltxml.XAttribute(xn, node.nodeValue);
        //}

        //private static processNode(node, el: XmppXElement): XmppXElement {
        //    var newEl = null;
        //    var ret = el;
        //    if (node.nodeType === 1) {
        //        newEl = Matrix.Xml.Factory.getElement(node.prefix, node.localName, node.namespaceURI);

        //        var atts = node.attributes;
        //        for (var i = 0; i < atts.length; i += 1) {
        //            var newAtt = this.processAttribute(atts[i]);
        //            newEl.add(newAtt);    
        //        }

        //        ret = newEl;
        //    }
        //    else if (node.nodeType === 3) {
        //        if (el != null /*&& !Functions.isUndefined(node.nodeValue)*/) {
        //            el.add(new Ltxml.XText(node.nodeValue));
        //            //el.setValue(node.nodeValue);
        //        }
        //    }
        //    else if (node.nodeType === 4) {
        //        newEl = new Ltxml.XCData(node.nodeValue);
        //    }

        //    if (newEl !== null) {
        //        if (el == null)
        //            el = newEl;
        //        else
        //            el.add(newEl);
        //    }
        //    return ret;
        //}
        //#endregion
    }
} 