"use strict";

import { AppParent } from "../../common/appparent";
import { HaMain } from "../../hamain";
import { ItemsManager } from "../../hamain/itemsmanager";
import { getLogger, Logger } from "log4js";
import { ICommand } from "./icommand";
import { IChannel } from "./ichannel";
import { ITransport } from "./itransport";
import { TransportSSH } from "./transportssh";
import { TransportSSHClient } from "./transportsshclient";

const CATEGORY: string = 'ConsoleInterface';
var logger: Logger = getLogger(CATEGORY);

/* -------------------------------------------------------------------------- *\
    Creates an SSH server to enable remote connections.

    Config format:
    consoleinterface:
        keyFile: "<path to host key file>"      # required
        host: "<host name or IP address"        # defaults to "0.0.0.0"
        port: <port number>                     # defaults to 8822
        certFiles:                              # optional
            - "<path to certfile for key based authentication>"
            - "<as many as you need>"
        users:                                  # currently required
            - { user: "<userid>", password: "<password>"}
\* -------------------------------------------------------------------------- */
export default class ConsoleInterface extends AppParent {
    private _config: any;
    private _controller: HaMain;
    private _items: ItemsManager;
    private _transport: ITransport = null;
    private _cmds: ICommand[] = [];
    private _lastCmd: ICommand = null;
    public constructor(controller: HaMain) {
        super(logger);
        this._controller = controller;
        this._items = controller.items;
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        let locName: string = this.controller.haConfig.location_name;
        this._config = config;
        this._transport = new TransportSSH(locName, this, this._config);

        if (!this._transport) {
            logger.error('Could not construct SSH transport');
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

    public async parseAndSend(client: TransportSSHClient, stream: IChannel, cmd: string): Promise<void> {
        return new Promise<void>(async (resolve, _reject) => {
            let words = cmd.trim().split(' ');

            let command = this._cmds.find((entry) => entry.commandName == words[0].toLowerCase());
    
            if (!command) {
                stream.write(`Unknown command: ${words[0]}\r\n`);
            }
            else {
                client.lastCommand = command;
                await command.execute(words, this, stream, this._cmds);
            }
            
            resolve();
        });
    }

    public async sendTerminate(client: TransportSSHClient, stream: IChannel) {
        if (this._lastCmd) {
            await client.lastCommand.terminate(this, stream);
        }
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
            new (require('./commandlogs')).CommandLogs(),
            new (require('./commandevents')).CommandEvents(),
        ];
        await this._transport.start();

        return true;
    }

    public async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._transport.stop()
            .then(() => resolve())
            .catch((err) => reject(err));
        });
    }
}
