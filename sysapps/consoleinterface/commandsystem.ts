"use strict";

import ConsoleInterface from ".";
import { CommandBase, CommandInfo } from './commandbase'; 
import { getLogger, Logger } from "log4js";
import { IChannelWrapper } from "./ichannelwrapper";
import os from 'os';
import { ICommand } from "./icommand";
// import path from 'path';

const CATEGORY: string = 'CommandSystem';
var logger: Logger = getLogger(CATEGORY);

export function factory(): ICommand {
    return new CommandSystem();
}

const commandInfo: CommandInfo = {
    commandName: 'system',
    subcommands: [ 
        {
            subcommandName: 'restart',
            description: 'Restart nodedaemon'
        },
        {
            subcommandName: 'stop',
            description: 'Stop nodedaemon'
        },
        {
            subcommandName: 'uptime',
            description: 'Show how long nodedaemon has been running'
        },
        {
            subcommandName: 'status',
            description: 'Show connection status'
        },
        {
            subcommandName: 'hostname',
            description: 'Show name of host running nodedaemon'
        },
        {
            subcommandName: 'version',
            description: 'Show nodedaemon version'
        },
    ] 
}

export class CommandSystem extends CommandBase {
    public constructor() {
        // super('system', ['restart', 'stop', 'status', 'uptime', 'hostname', 'version']);
        super(commandInfo);
    }

    public get helpText(): string {
        return `${this.commandName} \trestart\t\t\tRestart Nodedaemon\r\n\tstop\t\t\tStop Nodedaemon\r\n\tuptime\t\t\tShow uptime\r\n\tstatus\t\t\tShow connection status\r\n\thostname\t\tShow hostname\r\n\tversion\t\t\tShow Nodedaemon version`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        try {
            this._validateParameters(inputArray);

            if (inputArray.length != 2) {
                throw new Error(`Too many parameters passed for ${inputArray[1]}`)
            }

            switch (inputArray[1]) {
                case 'restart':
                    // sock.write('Restarting Nodedaemon\r\n');
                    // spawn(process.argv.shift(), process.argv, { cwd: process.cwd(), detached: true, stdio: "inherit" });
                    // process.exit(0);
                    if (process.env['KEEPALIVE_RUNNING']) {
                        try {
                            await that.controller.restart();
                        }
                        catch (err) {
                            sock.write(`Restart failed: ${err}`);
                        }
                    }
                    else {
                        logger.error('Restart only supported when running under keepalive');
                    }
                break;
                case 'stop':
                    logger.debug('Stop called');
                    sock.write('Stopping Nodedaemon in five seconds\r\n');
                    setTimeout(async () => {
                        try {
                            await that.controller.stop();
                        }
                        catch (err) {
                            sock.write(`Stop failed: ${err}`);
                        }
                    }, 5000);
                break;
                case 'status':
                    sock.write(`${that.controller.isConnected? 'Connected' : 'Not connected'} to Home Assistant\r\n`);
                break;
                case 'uptime':
                    let millis: number = (new Date().getTime() - that.controller.startTime.getTime());
                    let seconds: string = (Math.floor((millis / 1000) % 60)).toString().padStart(2, '0') + ' second';
                    let minutes: string = (Math.floor((millis / (1000 * 60)) % 60)).toString().padStart(2, '0') + ' minute';
                    let hours: string = (Math.floor((millis / (1000 * 60 * 60)) % 24)).toString().padStart(2, '0') + ' hour';
                    let days: string = (Math.floor(millis / (1000 * 60 * 60 * 24) % 24)).toString() + ' day';
                    if (!seconds.startsWith('01')) seconds += 's';
                    if (!minutes.startsWith('01')) minutes += 's';
                    if (!hours.startsWith('01')) hours += 's';
                    if (!days.startsWith('1')) days += 's';
                    sock.write(`${days} ${hours} ${minutes} ${seconds}\r\n`);
                break;
                case 'hostname':
                    sock.write(`Hostname: ${os.hostname()}\r\n`);
                break;
                case 'version':
                    sock.write(`${that.controller.version}\r\n`);
                break;
                default:
                    throw new Error('Parameter validation error - this should not happen');
            }

            return 0;
        }
        catch (err: any) {
            this._displayError(logger, sock, err);
            return 4;
        }
    }
}
