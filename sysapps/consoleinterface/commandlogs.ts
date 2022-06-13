import ConsoleInterface from ".";
import { IChannel } from "./ichannel";
import { CommandBase } from "./commandbase";
import { getLogger, Logger } from "log4js";
import { logEmitter } from "../../common/emitlogger";
import { EventWaiter } from "../../common/eventwaiter";
// import { EventWaiter } from "../../common/eventwaiter";

const CATEGORY: string = 'CommandLogs';
var logger: Logger = getLogger(CATEGORY);

export class CommandLogs extends CommandBase {
    private _isRunning: boolean = false;
    private _sock: IChannel = null;
    private _regex: RegExp = null;
    private _ew: EventWaiter = null;
    private _messageWriter = (message:string) => { 
        if (this._regex == null || this._regex.exec(message) != null) {
            if (this._sock) this._sock.write(`${message.replace(/\n/g, '\r\n')}\r\n`); 
        }
    }
    public constructor() {
        super('logs');
    }

    public get helpText(): string {
        return `${this.commandName}\t<Optional Regex>\tFollow logs with optional filtering`;
    }

    public async execute(inputArray: string[], _that: ConsoleInterface, sock: IChannel): Promise<void> {
        return new Promise((resolve, reject) => {
            // this._messageWriter = (message:string) => { if (this._sock) this._sock.write(`${message}\r\n`); }
            try {
                if (inputArray.length > 2) throw new Error('Only one optional argument is permitted')
                this._sock = sock;
                if (inputArray.length == 2) this._regex = new RegExp(inputArray[1]);
                console.log(this._regex);
                logEmitter.on('logmessage', this._messageWriter);
                this._isRunning = true;
                this._ew = new EventWaiter();
                this._ew.EventWait().then(() => resolve());
            }
            catch (err) {
                this._isRunning = false;
                logger.error(err.message);
                sock.write(`${err}\r\n`);
                sock.write('Usage:\r\n');
                sock.write(this.helpText);
                sock.write('\r\n');
                reject(err);
            }
        });
    }

    public async terminate(_that: ConsoleInterface, _sock: IChannel): Promise<void> {
        if (this._isRunning) {
            logEmitter.off('logmessage', this._messageWriter);
            this._sock = null;
            this._ew.EventSet();
            this._isRunning = false;
        }
    }
}
