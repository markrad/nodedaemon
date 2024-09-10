import { Level, Logger } from "log4js";
import { IApplication } from "./IApplication";
import { LogLevelValidator } from './loglevelvalidator';
import { EventEmitter } from 'events';
import { HaMain } from "../hamain";

/**
 * Represents an abstract class that serves as a base for application parent classes.
 * @extends EventEmitter
 * @implements IApplication
 */
export abstract class AppParent extends EventEmitter implements IApplication {
    private _logger: Logger;
    private _controller: HaMain;
    constructor(controller: HaMain, logger: Logger) {
        super();
        this._logger = logger;
        this._controller = controller;
    }
    /**
     * Validates the provided configuration object.
     * 
     * @param config - The configuration object to validate.
     * @returns A boolean indicating whether the validation was successful.
     */
    async validate(config: any): Promise<boolean> {
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

    /**
     * This function must be implemented by the derived class.
     */
    abstract run(): Promise<boolean>;
    
    /**
     * This function must be implemented by the derived class.
     */
    abstract stop(): Promise<void>;

    /**
     * Gets the controller instance.
     *
     * @returns The controller instance.
     */
    public get controller(): HaMain {
        return this._controller;
    }

    /**
     * Gets the logging level of the app parent.
     * @returns The logging level as a string or Level object.
     */
    public get logging(): string | Level {
        return this._logger.level;
    }

    /**
     * Sets the logging level for the application.
     * 
     * @param value - The logging level to set. Can be a string or a Level enum value.
     * @throws Error if an invalid logging level is passed.
     */
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