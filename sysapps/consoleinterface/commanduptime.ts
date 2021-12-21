import ConsoleInterface from ".";
import { IChannel } from "./ichannel";
import { CommandBase } from "./commandbase";

export class CommandUptime extends CommandBase {
    public constructor() {
        super('uptime');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tTime since last restart`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            this._validateParameters(inputArray);
            let millis: number = (new Date().getTime() - that.controller.startTime.getTime());
            let seconds: string = (Math.floor((millis / 1000) % 60)).toString().padStart(2, '0') + ' second';
            let minutes: string = (Math.floor((millis / (1000 * 60)) % 60)).toString().padStart(2, '0') + ' minute';
            let hours: string = (Math.floor((millis / (1000 * 60 * 60)) % 24)).toString().padStart(2, '0') + ' hour';
            let days: string = (Math.floor(millis / (1000 * 60 * 60 * 24) % 24)).toString() + ' day';
            if (!seconds.startsWith('01')) seconds += 's';
            if (!minutes.startsWith('01')) minutes += 's';
            if (!hours.startsWith('01')) hours += 's';
            if (!days.startsWith('1')) days += 's';
            sock.write(`${days} ${hours} ${minutes} ${seconds}\r\n`);
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}
