export class EventWaiter {
    private _resolvePtr: Function = null;
    private _promise: Promise<void> = null;
    constructor() {
        this._resolvePtr = null;
        this._promise = new Promise((resolve, _reject) => this._resolvePtr = resolve);
    }

    async EventWait() {
        return new Promise<void>((resolve, _reject) => {
            this._promise
                .then(() => resolve())
                .catch((err) => console.log(err.message));
        });
    }

    EventSet() {
        this._resolvePtr();
    }
}
