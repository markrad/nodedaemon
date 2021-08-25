"use strict";

import { getLogger, Logger } from 'log4js';
import { ConsoleInterface } from '.';
import { IChannel } from './ichannel';
import { CommandBase } from './commandbase';
import { ICommand } from './ICommand';

const CATEGORY: string = 'CommandInspect';
var logger: Logger = getLogger(CATEGORY);

export class CommandInspect extends CommandBase {
    public constructor() {
        super('inspect');
    }

    public get helpText(): string {
        return `${this.commandName} <optional regex>\tInspect items optionally filtered by a regex query`;
    }

    public tabParameters(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        let possibles: string[] = [ ...that._controller.items.items ]
            .filter((item) => item[1].name.startsWith(parameters[1]))
            .map((item) => item[1].name)
            .sort((l, r) => l < r? -1 : 1);
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel, _commands: ICommand[]): Promise<void> {
        try {
            this._validateParameters(inputArray.slice(0, inputArray.length - 1));
            if (inputArray.length != 2) {
                throw new Error('Missing or invalid inspection target');
            }
            logger.debug(`inspect called with ${inputArray.join(' ')}`);
            let items = inputArray[1]
                ? that.items.getItemByName(inputArray[1], true) 
                : that.items.getItemByName();
            items.forEach((item) => {
                sock.write(`Entity Id = ${item.entityId}\r\n`);
                sock.write(`Type = ${item.type}\r\n`);
                sock.write(`State = ${item.state}\r\n`);
                sock.write('Attributes:\r\n');
                sock.write(`${JSON.stringify(item.attributes, null, 2).replace(/\n/g, '\r\n')}\r\n`);
            });
        }
        catch (err: any) {
            sock.write(`${err}\r\n`);
            sock.write('Usage:\r\n');
            sock.write(this.helpText);
            sock.write('\r\n');
        }
    }
}
