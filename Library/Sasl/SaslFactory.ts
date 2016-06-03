/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="saslmechanism.ts" />
/// <reference path="plainprocessor.ts" />
/// <reference path="digestmd5processor.ts" />
/// <reference path="scramprocessor.ts" />
module Matrix.Sasl.SaslFactory {

    "use strict";
    
    export function create(mech: SaslMechanism): SaslProcessor {
        if (mech === SaslMechanism.Plain)
            return new Sasl.PlainProcessor();
        
        if (mech === SaslMechanism.DigestMd5)
            return new Sasl.DigestMD5Processor();

        if (mech === SaslMechanism.ScramSha1)
            return new Sasl.ScramProcessor();

        return null;
    }
}  