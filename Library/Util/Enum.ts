/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Util.Enum {
    "use strict";

    export function toString(e: any, eVal: any): string {
        return e[eVal];
    }

    export function parse(e: any, val: string): any {
        for (var eMember in e) {
            var eText = toString(e, eMember);
            if (typeof eText === 'string') {
                if (eText.toLocaleLowerCase() === val.toLocaleLowerCase())
                    return eMember;
            }
        }
        return -1;
    }
} 