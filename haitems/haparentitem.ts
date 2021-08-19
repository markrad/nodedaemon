import EventEmitter from 'events';
import { Logger, getLogger } from 'log4js';
import { resolve } from 'path';
import { emit } from 'process';
// import { AnyAaaaRecord, AnyARecord } from 'dns';

// Super slow for debugging
const RESPONSE_TIMEOUT_DEBUG: number = 30 * 1000
const RESPONSE_TIMEOUT: number = 3 * 1000

export type ServiceTarget = {
    entity_id?: string;
    [key: string]: number | string;
}

export interface IHaItem {
    get logger(): Logger;
    get attributes(): any;
    get name(): string;
    get friendlyName(): string;
    get type(): string;
    get lastChanged(): Date;
    get lastUpdated(): Date;
    get state(): any;           // TODO probably a string
    get entityId(): string;
    get category(): string;
    get isSwitch(): boolean;
    // TODO finish this interface
}

export class HaParentItem extends EventEmitter implements IHaItem {
        _attributes: any;
        _name: string;
        _type: string;
        _friendlyName: string;
        _lastChanged: Date;
        _lastUpdated: Date;
        _state: any;
        _logger: Logger;
    constructor(item: any, _transport?: any) {
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

    setReceivedState(newState: any) {
        let oldState: any = {
            attributes: this.attributes,
            state: this.state,
            lastUpdated: this.lastUpdated,
            lastChanged: this.lastChanged,
        };

        this._attributes = newState.attributes;
        this._state = newState.state;
        this._lastUpdated = new Date(newState.last_updated);
        this._lastChanged = new Date(newState.last_changed);
        this.emit('new_state', this, oldState);
    }

    async updateState(_newState: any): Promise<void> {
        let ret = new Promise<void>((_resolve, reject) => {
            reject(new Error('Descendent class is required to implement updateState'));
        });

        return ret;
    }

    callService(domain: string, service: string, state: ServiceTarget): void {
        this.emit('callservice', domain, service, state);
    }

    _callServicePromise(resolve: Function, newState: any, expectedState: string, domain: string, service: string, state: ServiceTarget): void {
        
        if (service == 'error') {
            let err: Error = new Error(`Bad value passed to updateState - ${newState}`);
            this.logger.error(`${err.message}`);
            resolve('error', err);
            return;
        }

        if (this.state != expectedState || this._childOveride(state)) {
            var timer = setTimeout(() => {
                var err = new Error('Timeout waiting for state change');
                this.logger.warn(`${err.message}`);
                resolve('error', err);
            }, RESPONSE_TIMEOUT);

            this.once('new_state', (that, _oldState) => {
                clearTimeout(timer);
                
                if (that.state == expectedState) {
                    resolve('success');
                }
                else {
                    var err = new Error('New state did not match expected state');
                    this.logger.info(`${err.message}`);
                    resolve('warn', err);
                }
            });

            this.callService(domain, service, state);
        }
        else {
            this.logger.debug(`Already in state ${this.state}`);
            resolve('nochange');
        }
    }

    _childOveride(state?: ServiceTarget): boolean {
        return false;
    }

    _getActionAndExpectedSNewtate(newState: any): { action: any, expectedNewState: any } {
        return { action: newState, expectedNewState: newState };
    }
}
