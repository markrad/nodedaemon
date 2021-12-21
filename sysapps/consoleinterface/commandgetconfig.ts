import ConsoleInterface from ".";
import { IChannel } from './ichannel';
import { CommandBase } from './commandbase';

export class CommandGetConfig extends CommandBase {
    public constructor() {
        super('getconfig');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\tReturns the Home Assistand configuration`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            this._validateParameters(inputArray);
            sock.write('Configuration:\r\n');
            sock.write(JSON.stringify(that.controller.haConfig, null, 2).replace(/\n/g, '\r\n'));
            sock.write('\r\n');
        }
        catch (err: any) {
            sock.write(`${err}\r\n`);
        }
    }
}
