import { ConsoleInterface, IChannel } from '.';
import { CommandBase } from './commandbase';
import { ICommand } from './ICommand';

export class CommandHelp extends CommandBase {
    constructor() {
        super('help');
    }

    get helpText(): string {
        return `${this.commandName}\t\t\t\tPrints this message`;
    }

    async execute(inputArray: string[], _that: ConsoleInterface, sock: IChannel, commands: ICommand[]): Promise<void> {
        try {
            this.validateParameters(inputArray);
            sock.write('Available commands:\r\n');
            commands.forEach((item: ICommand) => sock.write(`${item.helpText}\r\n`));
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}

// module.exports = CommandHelp;