import ConsoleInterface from ".";
import { CommandBase, CommandInfo } from './commandbase';
import { IChannelWrapper } from './ichannelwrapper';
import { getLogger, Logger } from 'log4js';
import { HaGenericSwitchItem } from "../../haitems/hagenericswitchitem";

const CATEGORY: string = 'CommandInspect';
var logger: Logger = getLogger(CATEGORY);

const commandInfo: CommandInfo = {
    commandName: 'inspect',
    subcommands: [ 
        {
            subcommandName: '<regex>',
            description: 'Inspect entities optionally filtered by <regex>',
            description2: 'Note: No <regex> will display a lot of data'
        }
    ]
}

class CommandInspect extends CommandBase {
    public constructor() {
        super(commandInfo);
    }

    public get helpText(): string {
        return `${this.commandName} <regex>\t\t\tInspect items optionally filtered by a regex query of entity id`;
    }

    public tabParameters(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        let possibles: string[] = [ ...that.controller.items.items ]
            .filter((item) => item[1].entityId.startsWith(parameters[1]))       // TODO: Make this resolve regex expressions (maybe)
            .map((item) => item[1].entityId)
            .sort((l, r) => l < r? -1 : 1);
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        return new Promise<number>((resolve, _reject) => {
            try {
                this._validateParameters(inputArray.slice(0, inputArray.length - 1));
                if (inputArray.length != 2) {
                    throw new Error('Missing or invalid inspection target');
                }
                logger.debug(`inspect called with ${inputArray.join(' ')}`);
                let items = that.items.getItemByEntityId(inputArray[1], true);
                items.forEach((item) => {
                    sock.writeLightMagenta(`Entity Id = ${item.entityId}\r\n`);
                    sock.write(`Type = ${item.type}\r\n`);
                    sock.write(`State = ${item.state}\r\n`);
                    if (item.isSwitch) {
                        sock.write(`Off time: ${(item as HaGenericSwitchItem).isTimerRunning? (item as HaGenericSwitchItem).timeBeforeOff / 1000 : 'inactive'}\r\n`);
                    }
                    sock.write(`Last Changed = ${item.lastChanged.toISOString()}\r\n`);
                    sock.write(`Last Updated = ${item.lastUpdated.toISOString()}\r\n`);
                    sock.write('Attributes:\r\n');
                    sock.write(`${JSON.stringify(item.attributes, null, 2).replace(/\n/g, '\r\n')}\r\n`);
                    resolve(0);
                });
            }
            catch (err: any) {
                this._displayError(logger, sock, err);
                resolve(4);
            }
        })
    }
}

export const factory = new CommandInspect();