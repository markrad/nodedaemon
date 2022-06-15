import ConsoleInterface from ".";
import { CommandBase } from './commandbase';
import { IChannelWrapper } from "./ichannelwrapper";
import { getLogger, Logger } from "log4js";

const CATEGORY: string = 'CommandGetConfig';
var logger: Logger = getLogger(CATEGORY);

export class CommandGetConfig extends CommandBase {
    public constructor() {
        super('getconfig');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\tReturns the Home Assistand configuration`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<void> {
        try {
            this._validateParameters(inputArray);
            sock.write('Configuration:\r\n');
            sock.write(JSON.stringify(that.controller.haConfig, null, 2).replace(/\n/g, '\r\n'));
            sock.write('\r\n');
        }
        catch (err: any) {
            this._displayError(logger, sock, err);
        }
    }
}
