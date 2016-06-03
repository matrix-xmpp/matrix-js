declare module Ltxml {
    export function addContentThatCanContainEntities(textToAdd, xobj, isElement, putContentFunc);
   
    export class XName {
        constructor(ns: XNamespace, name: string);
        constructor(name: string);
        get(expandedName);
        get(namespace, localName);
        toString(): string;

        localName();
        namespace();
        namespaceName();
    }


    interface XNamespace {
        new (uri): XNamespace;
        new (ns, prefix): XNamespace;
        get(uri);
        getName(localName);
        toString() : string;
        
        namespaceName;

        // http://www.w3.org/XML/1998/namespace
        getXml();                
        xml;

        // http://www.w3.org/2000/xmlns/
        getXmlns();              
        xmlns;

        // returns namespace for 'no namespace'
        getNone();
        none;
    }

    var XNamespace: XNamespace; 
       
    class XObject {
        
        addAnnotation(type: string, object);  // type is string
        annotation(type: string);
        annotations(type: string);
        removeAnnotations();
        removeAnnotations(type: string);

        nodeType;
        parent;

        getDocument();
        document;
    }

    class XNode extends XObject {
        addAfterSelf(varargs);
        addBeforeSelf(varargs);
        ancestors();
        ancestors(xname);
        deepEquals;
        elementsAfterSelf();
        elementsAfterSelf(xname);
        elementsBeforeSelf();
        elementsBeforeSelf(xname);
        nodesAfterSelf();
        nodesBeforeSelf();
        remove();
        replaceWith(content);

        //***** props implemented as field *****
        nodeType;
        parent;

        //***** props *****
        getNextNode();
        nextNode;

        getPreviousNode();
        previousNode;
    }

    class XText extends XNode {
        constructor(value: string);
        constructor(xtext: XText);

        toString();

        nodeType;
        parent;
        value;
    }

    class XAttribute extends XObject {
        constructor(name, value);
        constructor(xatt: XAttribute);
        
        remove();
        setValue(value);
        toString();

        isNamespaceDeclaration;
        name;
        nodeType;
        parent;
        value;

        getNextAttribute();
        nextAttribute;

        getPreviousAttribute();
        previousAttribute;
    }
  
    class XContainer extends XNode {
        add(content);
        addFirst(content);
        descendantNodes;
        descendants();
        descendants(xname);
        element(xname);
        elements(): linqjs.Enumerable;
        elements(xname) : linqjs.Enumerable;
        nodes();
        removeNodes();
        replaceNodes(content);

        //***** props implemented as fields *****
        nodeType;
        parent;

        //***** props *****
        getFirstNode();
        firstNode;

        getLastNode();
        lastNode;
    }

    class XProcessingInstruction extends XNode {
        constructor(xprocessingInstruction: XProcessingInstruction);
        constructor(target, data);

        toString();
        toString(indent);

        parent;
        target;
    }

    class XComment extends XNode {
        constructor(value);
        constructor(xcomment);

        toString();
        toString(indent);

        nodeType;
        parent;
        value;
    }

    class XCData extends XText {
        constructor(value);
        constructor(XCData: XCData);
        toString();
        nodeType;
        parent;
        value;
   
    }

    class XDeclaration {
        constructor(version, encoding, standalone);
        constructor(xdeclaration: XDeclaration);

        toString(indent);
        
        encoding;
        standalone;
        version;
    }

    class XElement extends XContainer {
        constructor(xelement);
        constructor(xname);
        constructor(xname, varargs1);
        constructor(xname, varargs1, varargs2);

        ancestorsAndSelf();
        ancestorsAndSelf(xname);
        attribute(xname);
        attributes();
        attributes(xname);
        descendantNodesAndSelf();
        descendantsAndSelf();
        descendantsAndSelf(xname);
        getDefaultNamespace();
        getNamespaceOfPrefix();
        getPrefixOfNamespace();
        load(XMLDocument);
        parse();
        removeAll();
        removeAttributes();
        replaceAll(content);
        replaceAttributes(content);
        setAttributeValue(xname, value);
        setElementValue(xname, value);
        toString():string;
        toString(indent:boolean): string;

        //    ***** props implemented as fields *****
        name: any;
        
        nodeType;
        parent;

        //    ***** props *****
        getFirstAttribute();
        firstAttribute;
        
        getHasAttributes();
        hasAttributes;
        
        getHasElements();
        hasElements;
        
        getIsEmpty();
        isEmpty;
        
        getLastAttribute();
        lastAttribute;
        
        getValue;
        setValue(val);
        value;
    }

    class XDocument extends XContainer {
        constructor();
        constructor(content);
        constructor(xdocument: XDocument);
        constructor(xdeclaration, content);

        descendants();
        descendants(xname);
        parse(xml);
        load(XMLDocument);
        toString();
        toString(indent);

        nodeType;
        parent;
        declaration;

        getRoot();
        root;
    }
   
    class XEntity extends XNode {
        constructor(value);
        constructor(XEntity: XEntity);
        toString();

        nodeType;
        parent;
        value;
    }

    class XEnumerable {
        constructor();
        constructor(source);
        getEnumerator():any;
        asEnumerable(): any;
        asXEnumerable(): any;
        ancestors(): any;
        ancestorsAndSelf(xname): any;
        attributes(xname): any;
        descendantNodes(): any;
        descendantNodesAndSelf(): any;
        descendants(xnam): any;
        descendantsAndSelf(xname): any;
        elements(xname): any;
        //InDocumentOrder():any;
        nodes(): any;
        remove(xname):any;
    }
} 