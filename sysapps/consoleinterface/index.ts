"use strict";

import { IApplication } from "../../common/IApplication";
import { HaMain } from "../../hamain";
import { ItemsManager } from "../../hamain/itemsmanager";
import { getLogger } from "log4js";
import { ICommand } from "./ICommand";

const CATEGORY = 'ConsoleInterface';
var logger = getLogger(CATEGORY);

export interface IChannel {
    write: (data: string) => void;
}

export interface ITransport {
    start(): Promise<void>;
    stop(): Promise<void>;
}

export class ConsoleInterface implements IApplication {
    _config: any;
    _controller: HaMain;
    _items: ItemsManager;
    _transports: ITransport[];
    constructor(controller: HaMain) {
        this._config;
        this._controller = controller;
        this._items = controller.items;
        this._transports = [];
    }

    validate(config: any): boolean {
        this._config = config;
        logger.info('Constructed');
        return true;
    }

    get items(): ItemsManager {
        return this._items;
    }

    get controller(): HaMain {
        return this._controller;
    }

    async run(): Promise<boolean> {
        let name: string = this.controller.haConfig.location_name;
        // TODO Expose this to simplify the help command?
        let cmds: ICommand[] = [
            new (require('./commandhelp')).CommandHelp(),
            new (require('./commandgetconfig')).CommandGetConfig(),
            new (require('./commanduptime')).CommandUptime(),
            new (require('./commandinspect')).CommandInspect(),
            new (require('./commandstop')).CommandStop(),
            new (require('./commandlist')).CommandList(),
            new (require('./commandapp')).CommandApp(),
            new (require('./commandha')).CommandHa(),
        ];

        if (this._config?.transports) {
            try {
                this._config.transports.forEach((transport: string) => {
                    try {
                        this._transports.push(new (require(transport))(name, this, cmds, this._config));
                    }
                    catch (err) {
                        logger.error(`Failed to create transport ${transport}: ${err}`);
                    }
                });
            }
            catch (err) {
                logger.error(`Failed to interate transports ${err}`);
            }
        }
        else {
            logger.warn('No transports specified');
        }

        this._transports.forEach(async (transport) => await transport.start());

        return true;
    }

    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            let rets = [];
            this._transports.forEach(async (transport) => rets.push(transport.stop()));
            Promise.all(rets)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    }
}

module.exports = ConsoleInterface;