/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp {
    "use strict";

    export enum MessageType {
        Normal = -1,
        Error,
        Chat,
        GroupChat,
        Headline
    }
    Object.freeze(MessageType);
}