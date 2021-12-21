"use strict";
// TODO Fix toggle autocomplete
import { getLogger, Logger } from 'log4js';
import ConsoleInterface from ".";
import { IChannel } from './ichannel';
import { CommandBase } from './commandbase';
import { ICommand } from './icommand';
import { IHaItemEditable, IHaItemSwitch, SafeItemAssign, ServicePromise } from '../../haitems/haparentitem';
import { IHaItem } from '../../haitems/ihaitem';
import { LogLevels } from '../../common/loglevelvalidator';
import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';

const CATEGORY: string = 'CommandSet';
var logger: Logger = getLogger(CATEGORY);

export class CommandSet extends CommandBase {
    public constructor() {
        super('set', ['state', 'log', 'on', 'off', 'toggle']);
    }

    public get helpText(): string {
        return `${this.commandName}\tlog <item> <loglevel>\r\n\tstate <item>\r\n\ton <item>\r\n\toff <item>\r\n\ttoggle <item>\t\tManipulate properties of item`;
    }

    public tabParameters(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        let possibles: string[];
        if (parameters.length == 4 && parameters[1] == 'log') {
            possibles = LogLevels().join('|').toLowerCase().split('|').filter((item) => item.startsWith(parameters[3]));
        }
        else if (parameters.length == 3) {
            possibles = [ ...that.controller.items.items ]
                .filter((item) => item[1].entityId.startsWith(parameters[2]))
                .filter((item) => parameters[1] == 'state'
                    ? item[1].isEditable 
                    : parameters[1] == 'on' || parameters[1] == 'off' || parameters[1] == 'toggle'
                    ? item[1].isSwitch
                    : parameters[1] == 'log'
                    ? true 
                    : false)
                .map((item) => item[1].entityId)
                .sort((l, r) => l < r? -1 : 1);
        }
        else if (parameters.length = 2) {
            possibles = this.parameters
                .filter((item) => item.startsWith(parameters[1]))
                .sort((l, r) => l.localeCompare(r));
        }
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel, _commands: ICommand[]): Promise<void> {
        try {
            this._validateParameters(inputArray);
            if (inputArray.length < 3) {
                throw new Error('Requires command and target item');
            }
            logger.debug(`set called with ${inputArray.join(' ')}`);
            let item: IHaItem[] = that.items.getItemByName(inputArray[2], false);

            if (item.length != 1) {
                throw new Error(`Item ${inputArray[2]} was not found`);
            }

            if (!item[0].isEditable && inputArray[1] != 'log') {
                throw new Error(`Specified item ${inputArray[2]} is not editable`);
            }

            let target: IHaItemEditable | IHaItemSwitch = SafeItemAssign(item[0]);
            let rc: ServicePromise;

            switch (inputArray[1]) {
                case "log":
                    if (inputArray.length == 3) {
                        sock.write(`Item ${item[0].name} has log level ${item[0].logging}\r\n`);
                    }
                    else {
                        item[0].logging = inputArray[3];
                        sock.write(`Item ${item[0].name} has log level ${item[0].logging}\r\n`);
                    }
                break;
                case "state":
                    if (inputArray.length < 4) {
                        throw new Error(`set state requires a new state be provided`);
                    }
                    if (inputArray.length > 4) {
                        throw new Error(`set state requires a new state to be a single word`);
                    }

                    rc = await target.updateState(inputArray[3]);

                    if (rc.err) {
                        sock.write(`Error: Command ${inputArray[3]} failed for ${target.entityId}: ${rc.err.message}\r\n`);
                    }
                    else {
                        sock.write(`Command complete - new state ${target.state}\r\n`);
                    }
                break;
                case "on":
                case "off":
                case "toggle":
                    if (!item[0].isSwitch) {
                        throw new Error('subcommand can only target a switch');
                    }
                    
                    rc = await (target as HaGenericSwitchItem).toggle();

                    if (rc.err) {
                        sock.write(`Error: Command ${inputArray[3]} failed for ${target.entityId}: ${rc.err.message}\r\n`);
                    }
                    else {
                        sock.write(`Command complete - new state ${target.state}\r\n`);
                    }
                break;
                default:
                    throw new Error(`Command ${inputArray[1]} is invalid`);
            }
        }
        catch (err: any) {
            sock.write(`${err}\r\n`);
            sock.write('Usage:\r\n');
            sock.write(this.helpText);
            sock.write('\r\n');
        }
    }
}
