/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp.Bosh {

    export var conditionMapping =
        [
            "bad-request",
            "host-gone",
            "host-unknown",
            "improper-addressing",
            "internal-server-error",
            "item-not-found",
            "other-request",
            "policy-violation",
            "remote-connection-failed",
            "remote-stream-error",
            "see-other-uri",
            "system-shutdown",
            "undefined-condition"
        ];

    Object.freeze(conditionMapping);

    export enum Condition {
        None = -1,

        /// <summary>
        /// The format of an HTTP header or binding element received from the client is unacceptable (e.g., syntax error).
        /// </summary>
        BadRequest = 0,
    
        /// <summary>
        /// The target domain specified in the 'to' attribute or the target host or port specified in the 'route' attribute is no longer 
        /// serviced by the connection manager.
        /// </summary>
        HostGone,

        /// <summary>
        /// The target domain specified in the 'to' attribute or the target host or port specified in the 'route' attribute is unknown 
        /// to the connection manager.
        /// </summary>
        HostUnknown, 
        
        /// <summary>
        /// The initialization element lacks a 'to' or 'route' attribute (or the attribute has no value) but the connection manager requires one.
        /// </summary>
        ImproperAddressing,
        
        /// <summary>
        /// The connection manager has experienced an internal error that prevents it from servicing the request.
        /// </summary>
        InternalServerError,

        /// <summary>
        /// (1) 'sid' is not valid, 
        /// (2) 'stream' is not valid, 
        /// (3) 'rid' is larger than the upper limit of the expected window, 
        /// (4) connection manager is unable to resend response, 
        /// (5) 'key' sequence is invalid.
        /// </summary>
        ItemNotFound,

        /// <summary>
        /// Another request being processed at the same time as this request caused the session to terminate.
        /// </summary>
        OtherRequest,

        /// <summary>
        /// The client has broken the session rules (polling too frequently, requesting too frequently, sending too many simultaneous requests).
        /// </summary>
        PolicyViolation,

        /// <summary>
        /// The connection manager was unable to connect to, or unable to connect securely to, or has lost its connection to, the server.
        /// </summary>
        RemoteConnectionFailed,
        
        /// <summary>
        /// Encapsulates an error in the protocol being transported.
        /// </summary>
        RemoteStreamError,
        
        /// <summary>
        /// The connection manager does not operate at this URI (e.g., the connection manager accepts only SSL or TLS connections at some
        /// https: URI rather than the http: URI requested by the client). The client can try POSTing to the URI in the content of the
        /// &lt;uri/&gt; child element.
        /// </summary>
        SeeOtherUri,
        
        /// <summary>
        /// The connection manager is being shut down. All active HTTP sessions are being terminated. No new sessions can be created.
        /// </summary>
        SystemShutdown,
        
        /// <summary>
        /// The error is not one of those defined herein; the connection manager SHOULD include application-specific information in the
        /// content of the <body/> wrapper.
        /// </summary>
        UndefinedCondition
    }

    Object.freeze(Condition);

    export function conditionToEnum(val: string): Condition {
        for (var i = 0; i < conditionMapping.length; i++) {
            if (conditionMapping[i] === val)
                return i;
        }
        return Condition.None;
    }

    export function enumToCondition(cond: Condition): string {
        if (cond !== -1)
            return conditionMapping[cond];

        return null;
    }
} 