"use strict";

import { AppParent } from "../../common/appparent";
import { HaMain } from "../../hamain";
import { ItemsManager } from "../../hamain/itemsmanager";
import { getLogger, Logger } from "log4js";
import { ICommand } from "./icommand";
import { ITransport } from "./itransport";
import { TransportSSH } from "./transportssh";
import { TransportSSHClient } from "./transportsshclient";
import { IChannelWrapper } from "./ichannelwrapper";

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

export const enum TERMCOLOR {
    RED = '\x1b[31m',
    GREEN = '\x1b[32m',
    ORANGE = '\x1b[33m',
    BLUE = '\x1b[34m',
    MAGENTA = '\x1b[35m',
    CYAN = '\x1b[36m',
    LIGHT_GRAY = '\x1b[37m',
    LIGHT_BLUE = '\x1b[94m',
    LIGHT_MAGENTA = '\x1b[95m',
    DEFAULT = '\x1b[39m'
};

export default class ConsoleInterface extends AppParent {
    private _config: any;
    private _items: ItemsManager;
    private _transport: ITransport = null;
    private _cmds: ICommand[] = [];
    private _lastCmd: ICommand = null;
    public constructor(controller: HaMain) {
        super(controller, logger);
        this._items = controller.items;
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
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

    public get commands(): ICommand[] {
        return this._cmds;
    }

    public async parseAndSend(client: TransportSSHClient, stream: IChannelWrapper, cmd: string): Promise<number> {
        return new Promise<number>(async (resolve, _reject) => {
            let rc: number = 0;
            let words = cmd.trim().split(' ');

            let command = this._cmds.find((entry) => entry.commandName == words[0].toLowerCase());
    
            if (!command) {
                stream.write(TERMCOLOR.RED + `Unknown command: ${words[0]}\r\n` + TERMCOLOR.DEFAULT);
                rc = -1;
            }
            else {
                client.lastCommand = command;
                try {
                    stream.setColor(TERMCOLOR.LIGHT_BLUE);
                    rc = await command.execute(words, this, stream, this._cmds);
                    stream.setColor(TERMCOLOR.DEFAULT);
                }
                catch (_err) {
                    // Don't really care about errors thrown here. Command module should handle them
                    // Here in case it might be useful later
                }
            }
            
            resolve(rc);
        });
    }

    public async sendTerminate(client: TransportSSHClient, stream: IChannelWrapper) {
        if (this._lastCmd) {
            await client.lastCommand.terminate(this, stream);
        }
    }

    public async run(): Promise<boolean> {
        this._cmds = [
            new (require('./commandhelp')).CommandHelp(),
            new (require('./commandversion')).CommandVersion(),
            new (require('./commandhostname')).CommandHostname(),
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
