import { Logger } from "log4js";
import { IApplication } from "./IApplication";
import { LogLevelValidator } from './loglevelvalidator';
import { EventEmitter } from 'events';

export abstract class AppParent extends EventEmitter implements IApplication {
    private _logger: Logger;
    constructor(logger: Logger) {
        super();
        this._logger = logger;
    }
    abstract validate(config: any): boolean;
    abstract run(): Promise<boolean>;
    abstract stop(): Promise<void>;

    public get logging(): string {
        return this._logger.level;
    }

    public set logging(value: string) {
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