/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */

/// <reference path="../Xml/XmppXElement.ts" />
/// <reference path="../EventArgs.ts" />
/// <reference path="../ExceptionEventArgs.ts" />
/// <reference path="../TextEventArgs.ts" />
module Matrix.Net {

    import XmppXElement = Matrix.Xml.XmppXElement;

    export interface ISocket {
        send(el: XmppXElement | string);

        connect(): void;
        disconnect(): void;

        onConnect: GenericEvent<EventArgs>;
        onDisconnect: GenericEvent<EventArgs>;

        onReadData: GenericEvent<TextEventArgs>;
        onWriteData: GenericEvent<TextEventArgs>;

        onError: GenericEvent<ExceptionEventArgs>;
    }
}