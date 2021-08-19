import { ConsoleInterface, IChannel } from ".";

import { getLogger } from "log4js";
import { CommandBase } from './commandbase'; 

const CATEGORY: string = 'CommandStop';
var logger = getLogger(CATEGORY);

export class CommandStop extends CommandBase {
    constructor() {
        super('stop');
    }

    get helpText(): string {
        return `${this.commandName}\t\t\t\tStops the service`;
    }

    async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            this.validateParameters(inputArray);
            logger.debug('Stop called');
            sock.write('Requested stop will occur in five seconds\r\n');
            setTimeout(async () => {
                await that.controller.stop();
                process.exit(0);
            }, 5000);
            }
        catch (err: any) {
            sock.write(`${err}\r\n`);
        }
    }
}
