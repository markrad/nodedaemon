"use strict";
// TODO Fix toggle autocomplete
import { getLogger, Level, Logger } from 'log4js';
import ConsoleInterface from ".";
import { IChannelWrapper } from './ichannelwrapper';
import { CommandBase, CommandInfo } from './commandbase';
import { ICommand } from './icommand';
import { HaParentItem, ServicePromise } from '../../haitems/haparentitem';
import { LogLevels } from '../../common/loglevelvalidator';
import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
import HaItemButton from '../../haitems/haitembutton';

const CATEGORY: string = 'CommandSet';
var logger: Logger = getLogger(CATEGORY);

const commandInfo: CommandInfo = {
    commandName: 'set',
    subcommands: [ 
        {
            subcommandName: 'log',
            subcommandParm: '[item] <level>',
            description: 'Get or set logging for [item]',
            description2: 'where <level> = trace | debug | info | warn | error | fatal'
        },
        {
            subcommandName: 'state',
            subcommandParm: '[item] <state>',
            description: 'Get or set the state of [item] to <state>'
        },
        {
            subcommandName: 'on',
            subcommandParm: '[item]',
            description: 'Switch [itme] to on'
        },
        {
            subcommandName: 'off',
            subcommandParm: '[item]',
            description: 'Switch [item] to off'
        },
        {
            subcommandName: 'toggle',
            subcommandParm: '[item]',
            description: 'Invert state of [item]'
        },
        {
            subcommandName: 'press',
            subcommandParm: '[item]',
            description: 'Momentary close of [item]'
        },
    ] 
}

export class CommandSet extends CommandBase {
    public constructor() {
        // super('set', ['state', 'log', 'on', 'off', 'toggle', 'press']);
        super(commandInfo);
    }

    public get helpText(): string {
        return `${this.commandName}\tlog <item> <loglevel>\r\n\tstate <item> <optional new state>\r\n\tpress <item>\r\n\ton <item>\r\n\toff <item>\r\n\ttoggle <item>\t\tManipulate properties of item`;
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
                    : parameters[1] == 'press'
                    ? item[1].isButton
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

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper, _commands: ICommand[]): Promise<number> {
        try {
            this._validateParameters(inputArray);
            if (inputArray.length < 3) {
                throw new Error('Requires command and target item');
            }
            logger.debug(`set called with ${inputArray.join(' ')}`);
            let item: HaParentItem = that.items.getItemAsEx(inputArray[2], HaParentItem, true);

            if (!item.isEditable && inputArray[1] != 'log') {
                throw new Error(`Specified item ${inputArray[2]} is not editable`);
            }

            let rc: ServicePromise;

            switch (inputArray[1]) {
                case "log":
                    if (inputArray.length == 3) {
                        sock.write(`Item ${item.name} has log level ${item.logging}\r\n`);
                    }
                    else {
                        item.logging = inputArray[3];
                        logger.info(`Logging for ${item.name} has been set to ${(item.logging as unknown as Level).levelStr}`)
                        sock.write(`Item ${item.name} has log level ${item.logging}\r\n`);
                    }
                break;
                case "state":
                    if (inputArray.length < 3) {
                        throw new Error(`set state requires a device and optionally a new state`);
                    }
                    if (inputArray.length > 4) {
                        throw new Error(`set state requires a new state to be a single word`);
                    }
                    if (inputArray.length == 4) {
                        rc = await item.updateState(inputArray[3], false);

                        if (rc.err) {
                            sock.write(`Error: Command ${inputArray[3]} failed for ${item.entityId}: ${rc.err.message}\r\n`);
                        }
                        else {
                            sock.write(`Command complete - new state ${item.state}\r\n`);
                        }
                    }
                    else {
                        sock.write(`Item ${item.name} is in state ${item.state}\r\n`);
                    }
                break;
                case "on":
                case "off":
                case "toggle":
                    if (!item.isSwitch) {
                        throw new Error('Subcommand can only target a switch');
                    }
                    
                    rc = inputArray[1] == 'toggle'
                        ? await (item as HaGenericSwitchItem).toggle()
                        : inputArray[1] == 'on'
                        ? await (item as HaGenericSwitchItem).turnOn()
                        : await (item as HaGenericSwitchItem).turnOff();

                    if (rc.err) {
                        sock.write(`Error: Command ${inputArray[1]} failed for ${item.entityId}: ${rc.err.message}\r\n`);
                    }
                    else {
                        sock.write(`Command complete - new state ${item.state}\r\n`);
                    }
                break;
                case "press":
                    if (!item.isButton) {
                        throw new Error('Subcommand can only target a button');
                    }
                    await (item as HaItemButton).press();
                break;
                default:
                    throw new Error(`Command ${inputArray[1]} is invalid`);
            }
            return 0;
        }
        catch (err: any) {
            this._displayError(logger, sock, err);
            return 4;
        }
    }
}
