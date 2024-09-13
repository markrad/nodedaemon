/**
 * Represents an event waiter that allows waiting for an event to occur.
 */
export class EventWaiter {
    private _resolvePtr: Function = null;
    private _rejectPtr: Function = null;
    private _promise: Promise<void> = null;
    private _resolved = false;
    private _rejected = false;
    constructor() {
        this.EventReset();
    }

    /**
     * Resets the event waiter, initializing the internal state and creating a new promise.
     */
    EventReset(): void {
        this._resolved = false;
        this._rejected = false;
        this._promise = new Promise((resolve, reject) => {
            this._resolvePtr = resolve;
            this._rejectPtr = reject;
        });
    }

    /**
     * Asynchronously waits for an event to occur.
     * @returns A promise that resolves when the event occurs, or rejects if there is an error.
     */
    async EventWait() {
        return new Promise<void>((resolve, reject) => {
            this._promise.then(() => resolve(), (err: any) => reject(err));
        });
    }

    /**
     * Sets the event.
     */
    EventSet() {
        this._resolved = true;
        this._resolvePtr();
    }

    /**
     * Handles an error that occurred during an event.
     * 
     * @param err - The error that occurred.
     */
    EventError(err?: any) {
        this._rejected = true;
        this._rejectPtr(err);
    }

    /**
     * Returns a boolean value indicating whether the event is pending or not.
     *
     * @returns {boolean} True if the event is pending, false otherwise.
     */
    get EventIsPending(): boolean {
        return !(this._resolved || this._rejected);
    }

    /**
     * Gets a value indicating whether the event is resolved.
     *
     * @returns {boolean} A boolean value indicating whether the event is resolved.
     */
    get EventIsResolved(): boolean {
        return this._resolved;
    }

    /**
     * Gets the value indicating whether the event is rejected.
     *
     * @returns {boolean} The value indicating whether the event is rejected.
     */
    get EventIsRejected(): boolean {
        return this._rejected;
    }
}
