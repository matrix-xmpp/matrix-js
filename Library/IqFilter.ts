/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="Xmpp/IqType.ts" />
/// <reference path="IqEventArgs.ts" />
/// <reference path="Collections/Collections.ts" />
/// <reference path="XmppClient.ts" />
module Matrix {

    "use strict";

    import Dictionary = Matrix.Collections.Dictionary;
    import Iq = Matrix.Xmpp.Client.Iq;

    export class IqFilter {
        _dictFilter: Dictionary<string, FilterData> = new Dictionary<string, FilterData>();
        _xmppClient: XmppClient;

        constructor(xmppClient :XmppClient) {
            this._xmppClient = xmppClient;
            this._xmppClient.onIq.on(this.iqHandler);
        }

        public sendIq(iq: Iq, callback: { (data: IqEventArgs): void }, state?: any) {
            // check if the callback is null, in case of wrong usage of this class
            if (callback != null) {
                var fd = new FilterData(callback, state);
                this._dictFilter.setValue(iq.id, fd);
            }
            this._xmppClient.send(iq);
        }

        private iqHandler = (args: IqEventArgs) => {
            var iq = args.iq;

            if (iq == null)
                return;

            //iq response MUST be always either of type result or error
            if (iq.type != Xmpp.IqType.Error && iq.type != Xmpp.IqType.Result)
                return;

            var id = iq.id;
            if (!id)
                return;

            if (!this._dictFilter.containsKey(id))
                return;

            var filteData = this._dictFilter.getValue(id);
            this._dictFilter.remove(id);

            var iqEventArg = new IqEventArgs(iq);
            iqEventArg.state = filteData.state;
            filteData.iqCallback(iqEventArg);
        };
    }
} 