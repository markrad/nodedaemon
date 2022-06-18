import ConsoleInterface from ".";
import { IChannel } from './ichannel';
import { CommandBase } from './commandbase';
import { ICommand } from './icommand';

export class CommandHelp extends CommandBase {
    public constructor() {
        super('help');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tPrints this message`;
    }

    public async execute(inputArray: string[], _that: ConsoleInterface, sock: IChannel, commands: ICommand[]): Promise<number> {
        try {
            this._validateParameters(inputArray);
            sock.write(`Version: ${_that.controller.version} - Available commands:\r\n`);
            commands.forEach((item: ICommand) => sock.write(`${item.helpText}\r\n`));
            return 0;
        }
        catch (err) {
            sock.write(`${err}\r\n`);
            return 4;
        }
    }
}
