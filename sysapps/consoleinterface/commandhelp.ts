import ConsoleInterface from ".";
import { IChannel } from './ichannel';
import { CommandBase, CommandInfo } from './commandbase';
import { ICommand } from './icommand';

export function factory(): ICommand {
    return new CommandHelp();
}

const commandInfo: CommandInfo = {
    commandName: 'help',
    subcommands: [ 
        {
            subcommandName: '',
            description: 'Prints this message'
        }
    ]
}

export class CommandHelp extends CommandBase {
    public constructor() {
        super(commandInfo);
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tPrints this message`;
    }

    public async execute(inputArray: string[], _that: ConsoleInterface, sock: IChannel, commands: ICommand[]): Promise<number> {
        try {
            this._validateParameters(inputArray);
            sock.write(`Version: ${_that.controller.version}\r\n`);
            sock.write('Items in [] are required; items in <> are optional\r\nAvailable commands:\r\n');
            commands.forEach((item: ICommand) => sock.write(`${item.helpTextx}`));
            return 0;
        }
        catch (err) {
            sock.write(`${err}\r\n`);
            return 4;
        }
    }
}
