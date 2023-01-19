"use strict";

import ConsoleInterface from ".";
import { CommandBase } from './commandbase';
import { ICommand } from './icommand';
import { IChannelWrapper } from './ichannelwrapper';
import { getLogger, Logger } from 'log4js';
import { HaGenericSwitchItem } from "../../haitems/hagenericswitchitem";

const CATEGORY: string = 'CommandInspect';
var logger: Logger = getLogger(CATEGORY);

export class CommandInspect extends CommandBase {
    public constructor() {
        super('inspect');
    }

    public get helpText(): string {
        return `${this.commandName} <regex>\t\t\tInspect items optionally filtered by a regex query of entity id`;
    }

    public tabParameters(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
            // let possibles: string[] = (parameters[1]
            //     ? that.items.getItemByEntytId(parameters[1], true) 
            // : that.items.getItemByEntytId())
            // .map((item: IHaItem) => item.entityId)
            // .sort((l, r) => l < r? -1 : 1);
        let possibles: string[] = [ ...that.controller.items.items ]
            .filter((item) => item[1].entityId.startsWith(parameters[1]))       // TODO: Make this resolve regex expressions (maybe)
            .map((item) => item[1].entityId)
            .sort((l, r) => l < r? -1 : 1);
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper, _commands: ICommand[]): Promise<number> {
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
                let sw = that.items.getItemAsEx(inputArray[1], HaGenericSwitchItem, false);
                if (sw) {
                    sock.write(`Off time: ${sw.isTimerRunning? sw.timeBeforeOff / 1000 : 'inactive'}\r\n`);
                }
                sock.write(`Last Changed = ${item.lastChanged.toISOString()}\r\n`);
                sock.write(`Last Updated = ${item.lastUpdated.toISOString()}\r\n`);
                sock.write('Attributes:\r\n');
                sock.write(`${JSON.stringify(item.attributes, null, 2).replace(/\n/g, '\r\n')}\r\n`);
                return 0;
            });
        }
        catch (err: any) {
            this._displayError(logger, sock, err);
            return 4;
        }
    }
}
