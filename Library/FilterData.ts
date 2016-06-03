/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
/// <reference path="IqEventArgs.ts" />
module Matrix {

    "use strict";

    export class FilterData {
        private _id: string;
        private _state: any;
        private _iqCallback: { (data: IqEventArgs): void }
        
        constructor(iqCallback?: { (data: IqEventArgs): void }, state?:any) {
            if (iqCallback)
                this.iqCallback = iqCallback;

            if (state)
                this.state = state;
        }

        public get id(): string { return this._id; }
        public set id(value: string) { this._id = value; }

        public get state(): any { return this._state; }
        public set state(value: any) { this._state = value; }

        public get iqCallback(): { (data: IqEventArgs): void } { return this._iqCallback; }
        public set iqCallback(value: { (data: IqEventArgs): void }) { this._iqCallback = value; }
    }
} 