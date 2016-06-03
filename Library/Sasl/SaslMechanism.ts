/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Sasl {

    "use strict";

    // array for mapping to the enum
    export var saslMechanismMapping =
    [
        "PLAIN",
        "DIGEST-MD5",
        "SCRAM-SHA-1",
        "ANONYMOUS"
    ];
    Object.freeze(saslMechanismMapping);

    export enum SaslMechanism {
        None = -1,
        Plain = 0,
        DigestMd5 = 1,
        ScramSha1 = 2,
        Anonymous = 3
    }
    Object.freeze(SaslMechanism);

    /* order for choosing Sasl Mechanism */
    export var saslMechanismPriorities =
        [
            2, // SCRAM
            1, // DIGEST-MD5",
            0, // PLAIN
            3  // ANONYMOUS"
        ];

    export function saslMechanismNameToEnum(val: string): SaslMechanism {
        for (var i = 0; i < Matrix.Sasl.saslMechanismMapping.length; i++) {
            if (Matrix.Sasl.saslMechanismMapping[i] === val)
                return i;
        }
        return SaslMechanism.None;
    }

    export function enumToSaslMechanismName(mech: Matrix.Sasl.SaslMechanism): string {
        if (mech !== -1)
            return Matrix.Sasl.saslMechanismMapping[mech];

        return null;
    }
}