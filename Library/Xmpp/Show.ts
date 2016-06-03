/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp {
    // array for mapping to the enum
    export var showMapping =
        [
            null,
            "away",
            "chat",
            "dnd",
            "xa"
        ];

    Object.freeze(showMapping);

    export enum Show {
        /// <summary>
        /// 
        /// </summary>
        None = -1,

        /// <summary>
        /// The entity or resource is temporarily away.
        /// </summary>
        //[Name("away")]
        Away = 0,

        /// <summary>
        /// The entity or resource is actively interested in chatting.
        /// </summary>
        //[Name("chat")]
        Chat = 1,

        /// <summary>
        /// The entity or resource is busy (dnd = "Do Not Disturb").
        /// </summary>
        //[Name("dnd")]
        DoNotDisturb = 2,

        /// <summary>
        /// The entity or resource is away for an extended period (xa = "eXtended Away").
        /// </summary>
        //[Name("xa")]
        ExtendedAway = 3,
    }
    Object.freeze(Show);

    export function showNameToEnum(val: string): Show {
        for (var i = 0; i < showMapping.length; i++) {
            if (showMapping[i] === val)
                return i;
        }
        return Show.None;
    }

    export function enumToShowName(show: Show): string {
        if (show !== -1)
            return showMapping[show];

        return null;
    }
} 