"use strict";

import { IApplication } from "../../common/IApplication";
import { HaMain } from "../../hamain";
import { ItemsManager } from "../../hamain/itemsmanager";
import { getLogger, Logger } from "log4js";
import { ICommand } from "./icommand";
import { IChannel } from "./ichannel";

const CATEGORY: string = 'ConsoleInterface';
var logger: Logger = getLogger(CATEGORY);

// TODO put exported interfaces into their own files
export interface ITransport {
    start(): Promise<void>;
    stop(): Promise<void>;
}

/* -------------------------------------------------------------------------- *\
    Two transports are provided and specified in the sample below. Either one
    can be dropped. For example you may not want to use telnet since it is 
    not encrypted and potentially insecure.

    Config format:
    {
        consoleInterface: {
            transports: ["./transportssh", "./transporttelnet" ],
        }
        "ssh": {
            "certFile": <path to public cert for certificate authentication>,
            "keyFile": <path to a key which I don't really get yet>,
            "users": [
                { "userid": "bob", "password": "bobspassword" }
            ]
        }
    }
\* -------------------------------------------------------------------------- */
export class ConsoleInterface implements IApplication {
    _config: any;
    _controller: HaMain;
    _items: ItemsManager;
    _transports: ITransport[] = [];
    _cmds: ICommand[] = [];
    public constructor(controller: HaMain) {
        this._controller = controller;
        this._items = controller.items;
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        this._config = config;
        logger.info('Validated successfully');
        return true;
    }

    public get items(): ItemsManager {
        return this._items;
    }

    public get controller(): HaMain {
        return this._controller;
    }

    public get commands(): ICommand[] {
        return this._cmds;
    }

    public async parseAndSend(stream: IChannel, cmd: string): Promise<void> {
        return new Promise<void>(async (resolve, _reject) => {
            let words = cmd.trim().split(' ');

            let command = this._cmds.find((entry) => entry.commandName == words[0].toLowerCase());
    
            if (!command) {
                stream.write(`Unknown command: ${words[0]}\r\n`);
            }
            else {
                await command.execute(words, this, stream, this._cmds);
            }
            
            resolve();
        });
    }

    public async run(): Promise<boolean> {
        let name: string = this.controller.haConfig.location_name;
        this._cmds = [
            new (require('./commandhelp')).CommandHelp(),
            new (require('./commandgetconfig')).CommandGetConfig(),
            new (require('./commanduptime')).CommandUptime(),
            new (require('./commandinspect')).CommandInspect(),
            new (require('./commandstop')).CommandStop(),
            new (require('./commandlist')).CommandList(),
            new (require('./commandset')).CommandSet(),
            new (require('./commandapp')).CommandApp(),
            new (require('./commandha')).CommandHa(),
        ];

        if (this._config?.transports) {
            try {
                this._config.transports.forEach((transport: string) => {
                    try {
                        this._transports.push(new (require(transport))(name, this, this._config));
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

    public async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            let rets: Promise<void>[] = [];
            this._transports.forEach(async (transport) => rets.push(transport.stop()));
            Promise.all(rets)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    }
}

module.exports = ConsoleInterface;