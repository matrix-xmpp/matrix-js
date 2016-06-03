/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../../Namespaces.ts" />
/// <reference path="../../Jid.ts" />
 module Matrix.Xmpp.Bind {

     import XmppXElement = Matrix.Xml.XmppXElement;

     export class Bind extends XmppXElement {
         constructor() {
             super(Namespaces.bind, "bind");
         }

         public get resource(): string {
             return this.getTag("resource");
         }

         public set resource(value: string) {
             this.setTag("resource", value);
         }

         public get jid(): Jid {
             return this.getTagJid("jid");
         }

         public set jid(value: Jid) {
             this.setTag("jid", value.toString());
         }
     }
 }