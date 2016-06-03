/// <reference path="../events.ts" />
/// <reference path="functions.ts" />
module Matrix.Util {
    export class Timer {
        public onTick = new GenericEvent<void>();

        _timerToken: number;
        _interval: number = 500;
        
        constructor(interval? : number) {
            if (!Util.Functions.isUndefined(interval))
                this.interval = interval;
        }

        public get interval(): number { return this._interval; }
        public set interval(value:number) { this._interval = value; }

        start() {
            this._timerToken = setInterval(() =>
                this.onTick.trigger(), this.interval);
        }

        stop() {
            clearTimeout(this._timerToken);
        }
    }
} 