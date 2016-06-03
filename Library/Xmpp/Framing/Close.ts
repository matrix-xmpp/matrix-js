/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../../Namespaces.ts" />
 module Matrix.Xmpp.Framing {
     import XmppXElement = Matrix.Xml.XmppXElement;

     export class Close extends XmppXElement {
         constructor() {
             super(Namespaces.framing, "close");
         }
     }
 }