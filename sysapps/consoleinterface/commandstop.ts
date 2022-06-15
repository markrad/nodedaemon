import ConsoleInterface from ".";
import { IChannelWrapper } from "./ichannelwrapper";

import { getLogger } from "log4js";
import { CommandBase } from './commandbase'; 

const CATEGORY: string = 'CommandStop';
var logger = getLogger(CATEGORY);

export class CommandStop extends CommandBase {
    public constructor() {
        super('stop');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tStops the service`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<void> {
        try {
            this._validateParameters(inputArray);
            logger.debug('Stop called');
            sock.write('Requested stop will occur in five seconds\r\n');
            setTimeout(async () => {
                await that.controller.stop();
                process.exit(0);
            }, 5000);
            }
        catch (err: any) {
            this._displayError(logger, sock, err);
        }
    }
}
