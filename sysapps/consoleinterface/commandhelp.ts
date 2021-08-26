import { ConsoleInterface } from '.';
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

    public async execute(inputArray: string[], _that: ConsoleInterface, sock: IChannel, commands: ICommand[]): Promise<void> {
        try {
            this._validateParameters(inputArray);
            sock.write('Available commands:\r\n');
            commands.forEach((item: ICommand) => sock.write(`${item.helpText}\r\n`));
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}
