"use strict";

import { getLogger, Logger } from 'log4js';
import { ConsoleInterface } from '.';
import { IChannel } from './ichannel';
import { CommandBase } from './commandbase';
import { ICommand } from './icommand';
import { IHaItem, IHaItemEditable, IHaItemSwitch, SafeItemAssign, ServicePromise } from '../../haitems/haparentitem';

const CATEGORY: string = 'CommandSet';
var logger: Logger = getLogger(CATEGORY);

export class CommandSet extends CommandBase {
    public constructor() {
        super('set', ['state', 'logging', 'on', 'off', 'toggle']);
    }

    public get helpText(): string {
        return `${this.commandName}\tstate\r\n\ton\r\n\toff\r\n\ttoggle\t\t\tManipulate properties of item`;
    }

    public tabParameters(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        let possibles: string[];
        if (parameters.length == 3) {
            possibles = [ ...that._controller.items.items ]
                .filter((item) => item[1].entityId.startsWith(parameters[2]))
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

            if (!item[0].isEditable) {
                throw new Error(`Specified item ${inputArray[2]} is not editable`);
            }

            let target: IHaItemEditable | IHaItemSwitch = SafeItemAssign(item[0]);
            let rc: ServicePromise;

            switch (inputArray[1]) {
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
                    
                    rc = await target.updateState(inputArray[1]);

                    if (rc.err) {
                        sock.write(`Error: Command ${inputArray[3]} failed for ${target.entityId}: ${rc.err.message}\r\n`);
                    }
                    else {
                        sock.write(`Command complete - new state ${target.state}\r\n`);
                    }
                break;
                case "logging":
                    sock.write('Not implemented\r\n')
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