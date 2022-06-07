import { Level, Logger } from 'log4js';
import { State } from '../hamain/state';

export interface IHaItem {
    get logger(): Logger;
    get attributes(): any;
    get name(): string;
    get friendlyName(): string;
    get type(): string;
    get lastChanged(): Date;
    get lastUpdated(): Date;
    get state(): string | number | boolean;
    get entityId(): string;
    get category(): string;
    get isSwitch(): boolean;
    get isButton(): boolean;
    get isEditable(): boolean;
    get support(): number;
    get logging(): string | Level;
    set logging(value: string | Level);
    setReceivedState(newState: State): void;
    on(eventName: string | symbol, listener: (...args: any[]) => void): void;
    off(eventName: String | symbol, listener: (...args: any[]) => void): void;
}
