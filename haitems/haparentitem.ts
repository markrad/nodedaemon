import EventEmitter from 'events';
import { Logger, getLogger, Level } from 'log4js';
import { State } from '../hamain/state';
import { IHaItem, ItemAttributes } from './ihaitem';
import { LogLevelValidator } from '../common/loglevelvalidator';

// Super slow for debugging
// const RESPONSE_TIMEOUT: number = 30 * 1000
const RESPONSE_TIMEOUT: number = 10 * 1000

export type ServiceTarget = {
    entity_id?: string;
    [key: string]: number | string;
}

export enum ServicePromiseResult {
    Success,
    NoChange,
    Warn,
    Error,
}

export type ServicePromise = {
    result: ServicePromiseResult;
    err?: Error;
}

export type ActionAndNewState = {
    action: string,
    expectedNewState: string
}

export interface IHaParentItemEvents {
    'new_state': (that: any, oldstate: any) => void;
    'callrestservice': (entityid: string, state: string | number | boolean, forceUpdate: boolean) => void;
    'callservice': (domain: string, service: string, state: ServiceTarget) => void;
};

export declare interface HaParentItem {
    on<U extends keyof IHaParentItemEvents>(event: U, listner: IHaParentItemEvents[U]): this;
    emit<U extends keyof IHaParentItemEvents>(event: U, ...args: Parameters<IHaParentItemEvents[U]>): boolean;
}

export class HaParentItem extends EventEmitter implements IHaItem {
    private _attributes: ItemAttributes;
    private _name: string;
    private _type: string;
    private _friendlyName: string;
    private _lastChanged: Date;
    private _lastUpdated: Date;
    private _state: string; // | number | boolean;
    private _logger: Logger;
    private _support: number;
    protected _stateChangeFn: (item: HaParentItem, state: State) => void;
    public constructor(item: State, logLevel: string | Level) {
        super();
        this._attributes = item.attributes;
        this._name = '';
        this._type = '';
        [this._type, this._name] = item.entity_id.split('.');
        this._logger = getLogger(this.category);
        this._friendlyName = item.attributes.friendly_name;
        this._lastChanged = new Date(item.last_changed);
        this._lastUpdated = new Date(item.last_updated);
        this._state = item.state;
        this._support = this.attributes?.supported_features ?? 0;
        this._stateChangeFn = this._defaultStateChangeFn;
        if (logLevel) this.logging = logLevel;
        this.on('new_state', (that, _oldstate) => this._stateChangeFn(that, _oldstate));
   }

    public get logger(): Logger {
        return this._logger;
    }

    public get attributes(): ItemAttributes {
        return this._attributes ?? null;
    }

    public get name(): string {
        return this._name;
    }

    public get friendlyName(): string {
        return this._friendlyName ?? '';
    }

    public get type(): string {
        return this._type;
    }

    public get lastChanged(): Date {
        return this._lastChanged;
    }

    public get lastUpdated(): Date {
        return this._lastUpdated;
    }

    public get state(): string | number | boolean | Date {
        return this._state;
    }

    public get rawState(): string {
        return this._state;
    }

    public get entityId(): string {
        return `${this.type}.${this.name}`;
    }

    public get category(): string {
        return `${this.constructor.name}:${this.name}`
    }

    public get isSwitch(): boolean {
        return false;
    }

    public get isButton(): boolean {
        return false;
    }

    public get isEditable(): boolean {
        return false;
    }
    
    public get support(): number {
        return this._support;
    }

    public setReceivedState(newState: State): void {
        let oldState: State = {
            entity_id: newState.entity_id,
            context: newState.context,
            attributes: this.attributes,
            state: this.rawState,
            last_updated: this.lastUpdated.toISOString().substr(0, 23) + '+00:00',
            last_changed: this.lastChanged.toISOString().substr(0, 23) + '+00:00',
        };

        this._attributes = newState.attributes;
        this._state = newState.state;
        this._lastUpdated = new Date(newState.last_updated);
        this._lastChanged = new Date(newState.last_changed);
        this.emit('new_state', this, oldState);
    }

    public async updateState(_newState: string | number | boolean | Date, _forceUpdate: boolean): Promise<ServicePromise> {
        throw new Error('This function should be overridden');
    }

    public get logging(): string | Level {
        return this.logger.level;
    }

    public set logging(value: string | Level) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            this.logger.error(err.message);
            throw err;
        }
        else {
            this.logger.level = value;
        }
    }

    public cleanUp(): void {
        this.removeAllListeners();
    }

    protected _defaultStateChangeFn(item: HaParentItem, _oldState: State) {
        this.logger.debug(`Received new state: ${item.state}`);
    }

    protected _callService(domain: string, service: string, state: ServiceTarget): void {
        this.emit('callservice', domain, service, state);
    }

    protected async _callServicePromise(resolve: (ret: ServicePromise) => void, newState: string | boolean | number, expectedState: string, domain: string, service: string, state: ServiceTarget): Promise<ServicePromise> {
        
        if (service == 'error') {
            let err: Error = new Error(`Bad value passed to updateState - ${newState}`);
            this.logger.error(`${err.message}`);
            resolve({ result: ServicePromiseResult.Error, err: err });
            return;
        }

        if (this.state != expectedState || this._childOverride(state)) {
            let timer: NodeJS.Timeout;
            let newState = (that: HaParentItem, _oldState: string | boolean | number) => {
                clearTimeout(timer);
                if (that.state == expectedState || expectedState == '**') {
                    resolve({ result: ServicePromiseResult.Success, err: null });
                }
                else {
                    var err = new Error(`New state did not match expected state - new state: ${that.state}, expected state: ${expectedState}`);
                    this.logger.info(`${err.message}`);
                    resolve({ result:ServicePromiseResult.Warn, err: err });
                }
            }                
            timer = setTimeout(() => {
                var err = new Error('Timeout waiting for state change');
                this.logger.warn(`${err.message}`);
                this.off('new_state', newState);
                resolve({ result: ServicePromiseResult.Error, err: err });
            }, RESPONSE_TIMEOUT);
            this.once('new_state', newState);
            this._callService(domain, service, state);
        }
        else {
            this.logger.debug(`Already in state ${this.state}`);
            resolve({ result: ServicePromiseResult.NoChange, err: null });
        }
    }

    protected _getActionAndExpectedNewState(newState: any): ActionAndNewState {
        return { action: newState, expectedNewState: newState };
    }

    protected _childOverride(_state: ServiceTarget): boolean {
        return false;
    }
}
