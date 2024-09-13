import { Level } from "log4js";
import { HaMain } from "../hamain";

/**
 * Interface for applications
 */
export interface IApplication {
    validate(config: any): Promise<boolean>;
    run(): Promise<boolean>;
    stop(): Promise<void>;
    get logging(): string | Level;
    set logging(value: string | Level);
    get controller(): HaMain;
    on?(eventName: string | symbol, listener: (...args: any[]) => void): void;
    once?(eventName: string | symbol, listener: (...args: any[]) => void): void;
    off?(eventName: String | symbol, listener: (...args: any[]) => void): void;
};