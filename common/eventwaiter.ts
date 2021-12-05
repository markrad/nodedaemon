export class EventWaiter {
    private _resolvePtr: Function = null;
    private _promise: Promise<void> = null;
    private _resolved = false;
    constructor() {
        this.EventReset();
    }

    async EventWait() {
        return new Promise<void>((resolve, _reject) => {
            this._promise
                .then(() => resolve())
                .catch((err) => console.log(err.message));
        });
    }

    EventReset(): void {
        this._resolvePtr = null;
        this._promise = new Promise((resolve, _reject) => this._resolvePtr = resolve);
    }

    EventSet() {
        this._resolved = true;
        this._resolvePtr();
    }

    get EventIsResolved(): boolean {
        return this._resolved;
    }
}
