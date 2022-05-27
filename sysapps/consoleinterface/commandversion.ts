import ConsoleInterface from ".";
import { IChannel } from "./ichannel";
import { CommandBase } from "./commandbase";

export class CommandVersion extends CommandBase {
    public constructor() {
        super('version');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tPrint version number`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            this._validateParameters(inputArray);
            sock.write(`Version: ${that.controller.version}\r\n`);
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}
