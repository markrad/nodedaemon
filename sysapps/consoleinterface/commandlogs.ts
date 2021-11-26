import { ConsoleInterface } from ".";
import { IChannel } from "./ichannel";
import { CommandBase } from "./commandbase";
// import { getLogger, Logger } from "log4js";
import { logEmitter } from "../../common/emitlogger";
// import { EventWaiter } from "../../common/eventwaiter";

// const CATEGORY: string = 'CommandLogs';
// var logger: Logger = getLogger(CATEGORY);

export class CommandLogs extends CommandBase {
    private _isRunning: boolean = false;
    public constructor() {
        super('logs');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tFollow logs`;
    }

    private messageWriter(sock: IChannel, message: string): void {
        sock.write(message);
    }

    public async execute(_inputArray: string[], _that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            logEmitter.on('logmessage', this.messageWriter);
            this._isRunning = true;
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }

    public async terminate(_that: ConsoleInterface, _sock: IChannel): Promise<void> {
        if (this._isRunning) {
            logEmitter.off('logmessage', this.messageWriter);
        }
    }
}
