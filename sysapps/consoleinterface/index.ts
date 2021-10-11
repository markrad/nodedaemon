"use strict";

import { IApplication } from "../../common/IApplication";
import { HaMain } from "../../hamain";
import { ItemsManager } from "../../hamain/itemsmanager";
import { getLogger, Logger } from "log4js";
import { ICommand } from "./icommand";
import { IChannel } from "./ichannel";
import { LogLevelValidator } from '../../common/loglevelvalidator';
import { ITransport } from "./itransport";

const CATEGORY: string = 'ConsoleInterface';
var logger: Logger = getLogger(CATEGORY);

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
    private _config: any;
    private _controller: HaMain;
    private _items: ItemsManager;
    private _transports: ITransport[] = [];
    private _cmds: ICommand[] = [];
    public constructor(controller: HaMain) {
        this._controller = controller;
        this._items = controller.items;
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        let validTransports: any  = { ssh: './transportssh', telnet: './transporttelnet' };
        let locName: string = this.controller.haConfig.location_name;
        this._config = config;
        if (this._config.transports) {
            if (!Array.isArray(this._config.transports)) {
                logger.error('Transports must be an array');
                return false;
            }
            this._config.transports.forEach((element: string) => {
                let work = validTransports[element];
                if (work) {
                    this._transports.push(new (require(work))(locName, this, this._config));
                }
                else {
                    logger.warn(`Transport ${element} does not exist`);
                }
            });

            if (this._transports.length == 0) {
                logger.error('No valid transports were specified');
                return false;
            }
        }
        else {
            logger.error('No transports specified');
            return false;
        }
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

    public get logging(): string {
        return logger.level;
    }

    public set logging(value: string) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            logger.error(err.message);
            throw err;
        }
        else {
            logger.level = value;
        }
    }
}

module.exports = ConsoleInterface;