import { Level } from 'log4js';
import { State } from '../hamain/state';
import { ServicePromise } from './haparentitem';

/**
 * Defines the attributes of an item.
 */
export type ItemAttributes = {
    friendly_name: string;
    supported_features?: number;
    [key: string]: any;
}

/**
 * Represents an interface for a Home Assistant item.
 */
export interface IHaItem {
    get name(): string;
    get friendlyName(): string;
    get type(): string;
    get lastChanged(): Date;
    get lastUpdated(): Date;
    get state(): string | number | boolean | Date;
    get attributes(): ItemAttributes;
    get rawState(): string;
    get entityId(): string;
    get category(): string;
    get isSwitch(): boolean;
    get isButton(): boolean;
    get isEditable(): boolean;
    get support(): number;
    get logging(): string | Level;
    set logging(value: string | Level);
    setReceivedState(newState: State): void;
    updateState(newState: string | number | boolean | Date, forceUpdate: boolean): Promise<ServicePromise>;
    cleanUp(): void;
    on(eventName: string | symbol, listener: (...args: any[]) => void): void;
    off(eventName: String | symbol, listener: (...args: any[]) => void): void;
}

/**
 * Represents the constructor for an IHaItem.
 * @param item - The state of the item.
 * @param logLevel - The log level (optional).
 * @returns An instance of IHaItem.
 */
export interface IHaItemConstructor {
    new(item: State, logLevel?: string): IHaItem;
}