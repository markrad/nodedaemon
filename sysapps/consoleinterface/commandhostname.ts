import ConsoleInterface from ".";
import { IChannelWrapper } from './ichannelwrapper';
import { CommandBase } from "./commandbase";
import { getLogger, Logger } from "log4js";
import os from 'os';

const CATEGORY: string = 'CommandHostname';
var logger: Logger = getLogger(CATEGORY);

export class CommandHostname extends CommandBase {
    public constructor() {
        super('hostname');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tPrint host name`;
    }

    public async execute(inputArray: string[], _that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        try {
            this._validateParameters(inputArray);
            sock.write(`Hostname: ${os.hostname()}\r\n`);
            return 0;
        }
        catch (err) {
            this._displayError(logger, sock, err)
            return 4;
        }
    }
}
