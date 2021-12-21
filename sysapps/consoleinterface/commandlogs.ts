import ConsoleInterface from ".";
import { IChannel } from "./ichannel";
import { CommandBase } from "./commandbase";
// import { getLogger, Logger } from "log4js";
import { logEmitter } from "../../common/emitlogger";
import { EventWaiter } from "../../common/eventwaiter";
// import { EventWaiter } from "../../common/eventwaiter";

// const CATEGORY: string = 'CommandLogs';
// var logger: Logger = getLogger(CATEGORY);

export class CommandLogs extends CommandBase {
    private _isRunning: boolean = false;
    private _sock: IChannel = null;
    private _ew: EventWaiter = null;
    private messageWriter: any = null;
    public constructor() {
        super('logs');
    }

    public get helpText(): string {
        return `${this.commandName}\t\t\t\tFollow logs`;
    }

    public async execute(_inputArray: string[], _that: ConsoleInterface, sock: IChannel): Promise<void> {
        return new Promise((resolve, reject) => {
            this.messageWriter = (message:string) => { if (this._sock) this._sock.write(`${message}\r\n`); }
            try {
                logEmitter.on('logmessage', this.messageWriter);
                this._isRunning = true;
                this._sock = sock;
                this._ew = new EventWaiter();
                this._ew.EventWait().then(() => resolve());
            }
            catch (err) {
                this._isRunning = false;
                sock.write(`${err}\r\n`);
                reject(err);
            }
            });
    }

    public async terminate(_that: ConsoleInterface, _sock: IChannel): Promise<void> {
        if (this._isRunning) {
            logEmitter.off('logmessage', this.messageWriter);
            this._sock = null;
            this._ew.EventSet();
            this._isRunning = false;
        }
    }
}
