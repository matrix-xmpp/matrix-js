/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix {

    "use strict";

    export class StreamFeatureHelper {
        // TLS and compression not needed yet, maybe later for node.js when we need it
        _tls: boolean;
        _sasl: boolean;
        _compression: boolean;
        _resourceBinding : boolean;
        _sessionRequired: boolean;

        public get sasl(): boolean { return this._sasl; }
        public set sasl(value: boolean) { this._sasl = value; }

        public get resourceBinding(): boolean { return this._resourceBinding; }
        public set resourceBinding(value: boolean) { this._resourceBinding = value; }

        public get sessionRequired(): boolean { return this._sessionRequired; }
        public set sessionRequired(value: boolean) { this._sessionRequired = value; }

        //public get tls(): boolean { return this._tls; }
        //public set tls(value: boolean) { this._tls = value; }

        //public get compression(): boolean { return this._compression; }
        //public set compression(value: boolean) { this._compression = value; }

        public reset() {
            this.sasl = false;
            this._resourceBinding = false;
            //this.tls = false;
            //this.compression = false;
        }
    }
} 