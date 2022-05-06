import { Level, Logger } from "log4js";
import { IApplication } from "./IApplication";
import { LogLevelValidator } from './loglevelvalidator';
import { EventEmitter } from 'events';
import { HaMain } from "../hamain";

export abstract class AppParent extends EventEmitter implements IApplication {
    private _logger: Logger;
    private _controller: HaMain;
    constructor(controller: HaMain, logger: Logger) {
        super();
        this._logger = logger;
        this._controller = controller;
    }
    abstract validate(config: any): boolean;
    abstract run(): Promise<boolean>;
    abstract stop(): Promise<void>;

    public get controller(): HaMain {
        return this._controller;
    }

    public get logging(): string | Level {
        return this._logger.level;
    }

    public set logging(value: string | Level) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            this._logger.error(err.message);
            throw err;
        }
        else {
            this._logger.level = value;
        }
    }
}