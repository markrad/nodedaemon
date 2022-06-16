import ConsoleInterface from ".";
import { IChannelWrapper } from './ichannelwrapper';
import { CommandBase } from "./commandbase";
import { getLogger, Logger } from "log4js";

const CATEGORY: string = 'CommandVersion';
var logger: Logger = getLogger(CATEGORY);

export class CommandVersion extends CommandBase {
    public constructor() {
        super('version');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tPrint version number`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<void> {
        try {
            this._validateParameters(inputArray);
            sock.write(`Version: ${that.controller.version}\r\n`);
        }
        catch (err) {
            this._displayError(logger, sock, err)
        }
    }
}