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
    validate(config: any): boolean {
        if (config && config.logLevel) {
            try {
                let ll = LogLevelValidator(config.logLevel);

                if (!ll) {
                    this._logger.warn(`Invalid log level ${config.logLevel} passed to ${this._logger.category}`);
                }
                else {
                    this.logging = ll;
                    this._logger.info(`Set log level to ${config.logLevel}`);
                }
            }
            catch (err: any) {
                this._logger.error(`Failed to set log level to ${config.logLevel}`);
            }
        }
        return true;
    }

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