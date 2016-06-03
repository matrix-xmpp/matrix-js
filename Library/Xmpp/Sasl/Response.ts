/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="../../Collections/Collections.ts" />
/// <reference path="../../Util/Functions.ts" />
module Matrix.Xmpp.Sasl {
    "use strict";

    export class Response extends Base.Sasl {
        constructor(value?: string) {
            super("response");

            if (!Util.Functions.isUndefined(value))
                this.value = value;
        }
    }
}      