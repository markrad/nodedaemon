import EventEmitter from 'events';
import { Logger, getLogger } from 'log4js';
import { State } from '../hamain';
// import { AnyAaaaRecord, AnyARecord } from 'dns';

// Super slow for debugging
const RESPONSE_TIMEOUT_DEBUG: number = 30 * 1000
const RESPONSE_TIMEOUT: number = 3 * 1000

export type ServiceTarget = {
    entity_id?: string;
    [key: string]: number | string;
}

export type ServicePromise = {
    message: string;
    err: Error;
}

// TODO Needs own file
export interface IHaItem {
    get logger(): Logger;
    get attributes(): any;
    get name(): string;
    get friendlyName(): string;
    get type(): string;
    get lastChanged(): Date;
    get lastUpdated(): Date;
    get state(): string;
    get entityId(): string;
    get category(): string;
    get isSwitch(): boolean;
    get isEditable(): boolean;
    setReceivedState(newState: State): void;
    on(eventName: string | symbol, listener: (...args: any[]) => void): void;
    off(eventName: String | symbol, listener: (...args: any[]) => void): void;
    // TODO Finished maybe?
}

export interface IHaItemEditable extends IHaItem {
    get isEditable(): boolean;
    updateState(newState: string | boolean | number): Promise<ServicePromise>;
}

export interface IHaItemSwitch extends IHaItemEditable {
    turnOn(): Promise<ServicePromise>;
    turnOff(): Promise<ServicePromise>;
    toggle(): Promise<ServicePromise>;
    turnOffAt(moment: number): Promise<void>;
    get isOn(): boolean;
    get isOff(): boolean;
    get timeBeforeOff(): number;
    get isTimerRunning(): boolean;
}

export function SafeItemAssign(item: IHaItem, throwOnFailure: boolean = false): IHaItemEditable {
    let ret = (item.isEditable)
        ? item as IHaItemEditable
        : null;

    if (ret == null && throwOnFailure) {
        let msg: string = `Unable to convert ${item.entityId} to IHaItemEditable`;
        throw new Error(msg);
    }

    return ret;
}

export abstract class HaParentItem extends EventEmitter implements IHaItem {
        _attributes: any;
        _name: string;
        _type: string;
        _friendlyName: string;
        _lastChanged: Date;
        _lastUpdated: Date;
        _state: string;
        _logger: Logger;
    constructor(item: State) {
        super();
        this._attributes = item.attributes;
        this._name = '';
        this._type = '';
        [this._type, this._name] = item.entity_id.split('.');
        this._friendlyName = item.attributes.friendly_name;
        this._lastChanged = new Date(item.last_changed);
        this._lastUpdated = new Date(item.last_updated);
        this._state = item.state;
        this._logger = getLogger(this.category);
    }

    get logger(): Logger {
        return this._logger;
    }

    get attributes(): any {
        return this._attributes ?? {};
    }

    get name(): string {
        return this._name;
    }

    get friendlyName(): string {
        return this._friendlyName ?? '';
    }

    get type(): string {
        return this._type;
    }

    get lastChanged(): Date {
        return this._lastChanged;
    }

    get lastUpdated(): Date {
        return this._lastUpdated;
    }

    get state(): any {
        return this._state;
    }

    get entityId(): string {
        return `${this.type}.${this.name}`;
    }

    get category(): string {
        return `${this.constructor.name}:${this.name}`
        //return `${this.__proto__.constructor.name}:${this.name}`;
    }

    get isSwitch(): boolean {
        return false;
    }

    get isEditable(): boolean {
        return false;
    }

    setReceivedState(newState: State): void {
        let oldState: State = {
            entity_id: newState.entity_id,
            context: newState.context,
            attributes: this.attributes,
            state: this.state,
            last_updated: this.lastUpdated.toISOString().substr(0, 23) + '+00:00',
            last_changed: this.lastChanged.toISOString().substr(0, 23) + '+00:00',
        };

        this._attributes = newState.attributes;
        this._state = newState.state;
        this._lastUpdated = new Date(newState.last_updated);
        this._lastChanged = new Date(newState.last_changed);
        this.emit('new_state', this, oldState);
    }

    callService(domain: string, service: string, state: ServiceTarget): void {
        this.emit('callservice', domain, service, state);
    }

    _callServicePromise(resolve: (ret: ServicePromise) => void, newState: string | boolean | number, expectedState: string, domain: string, service: string, state: ServiceTarget): void {
        
        if (service == 'error') {
            let err: Error = new Error(`Bad value passed to updateState - ${newState}`);
            this.logger.error(`${err.message}`);
            resolve({ message: 'error', err: err });
            return;
        }

        if (this.state != expectedState || this._childOveride(state)) {
            var timer = setTimeout(() => {
                var err = new Error('Timeout waiting for state change');
                this.logger.warn(`${err.message}`);
                resolve({ message: 'error', err: err });
            }, RESPONSE_TIMEOUT);

            this.once('new_state', (that, _oldState) => {
                clearTimeout(timer);
                
                if (that.state == expectedState) {
                    resolve({ message: 'success', err: null });
                }
                else {
                    var err = new Error('New state did not match expected state');
                    this.logger.info(`${err.message}`);
                    resolve({ message: 'warn', err: err });
                }
            });

            this.callService(domain, service, state);
        }
        else {
            this.logger.debug(`Already in state ${this.state}`);
            resolve({ message: 'nochange', err: null });
        }
    }

    _childOveride(state?: ServiceTarget): boolean {
        return false;
    }

    _getActionAndExpectedSNewtate(newState: any): { action: any, expectedNewState: any } {
        return { action: newState, expectedNewState: newState };
    }
}
