import ConsoleInterface from ".";
import { CommandBase, CommandInfo } from './commandbase'; 
import { getLogger, Logger } from "log4js";
import { IChannelWrapper } from "./ichannelwrapper";

const CATEGORY: string = 'CommandHa';
var logger: Logger = getLogger(CATEGORY);

const commandInfo: CommandInfo = {
    commandName: 'ha',
    subcommands: [ 
        {
            subcommandName: 'status',
            description: 'Get Home Assistant status'
        },
        {
            subcommandName: 'restart',
            description: 'Restart Home Assistant'
        },
        {
            subcommandName: 'stop',
            description: 'Stop Home Assistant status'
        },
        {
            subcommandName: 'version',
            description: 'Display Home Assistant version'
        },
        {
            subcommandName: 'getconfig',
            description: 'Get Home Assistant configuration JSON'
        },
    ]
}

class CommandHa extends CommandBase {
    public constructor() {
        super(commandInfo)
    }

    public get helpText(): string {
        return `${this.commandName} \tstatus\t\t\tGet Home Assistant Status\r\n\trestart\t\t\tRestart Home Assistant\r\n\tstop\t\t\tStop Home Assistant\r\n\tversion\t\t\tShow Home Assistant version\r\n\tgetconfig\t\t\Get Home Assistant config`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        try {
            this._validateParameters(inputArray);

            if (inputArray.length != 2) {
                throw new Error(`Too many parameters passed for ${inputArray[1]}`)
            }

            switch (inputArray[1]) {
                case 'restart':
                    sock.write('Restarting Home Assistant\r\n');
                    that.controller.restartHA();
                    break;
                case 'stop':
                    sock.write('Stopping Home Assistant\r\n');
                    that.controller.stopHA();
                    break;
                case 'status':
                    sock.write(`${that.controller.isConnected? 'Connected' : 'Not connected'} to Home Assistant\r\n`);
                    break;
                case 'version':
                    sock.write(`${that.controller.haConfig.version}\r\n`);
                    break;
                case 'getconfig':
                    sock.write('Configuration:\r\n');
                    sock.write(JSON.stringify(that.controller.haConfig, null, 2).replace(/\n/g, '\r\n'));
                    sock.write('\r\n');
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

export const factory = new CommandHa();