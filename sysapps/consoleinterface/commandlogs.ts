import ConsoleInterface from ".";
import { CommandBase, CommandInfo } from "./commandbase";
import { getLogger, Logger } from "log4js";
import { logEmitter } from "../../common/emitlogger";
import { EventWaiter } from "../../common/eventwaiter";
import { IChannelWrapper } from "./ichannelwrapper";
import { ICommand } from "./icommand";

const CATEGORY: string = 'CommandLogs';
var logger: Logger = getLogger(CATEGORY);

export function factory(): ICommand {
    return new CommandLogs();
}

const commandInfo: CommandInfo = {
    commandName: 'logs',
    subcommands: [ 
        {
            subcommandName: '<regex>',
            description: 'Follow logs that match <regex>'
        }
    ]
}

export class CommandLogs extends CommandBase {
    private _isRunning: boolean = false;
    private _sock: IChannelWrapper = null;
    private _regex: RegExp = null;
    private _ew: EventWaiter = null;
    private _messageWriter = (message:string) => { 
        if (this._regex == null || this._regex.exec(message) != null) {
            if (this._sock) this._sock.write(`${message.replace(/\n/g, '\r\n')}\r\n`); 
        }
    }
    public constructor() {
        super(commandInfo);
    }

    public get helpText(): string {
        return `${this.commandName}\t<Optional Regex>\tFollow logs with optional filtering`;
    }

    public async execute(inputArray: string[], _that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        return new Promise<number>((resolve, _reject) => {
            // this._messageWriter = (message:string) => { if (this._sock) this._sock.write(`${message}\r\n`); }
            try {
                if (inputArray.length > 2) throw new Error('Only one optional argument is permitted')
                this._sock = sock;
                if (inputArray.length == 2) this._regex = new RegExp(inputArray[1]);
                else this._regex = null;
                logEmitter.on('logmessage', this._messageWriter);
                this._isRunning = true;
                this._ew = new EventWaiter();
                this._ew.EventWait().then(() => resolve(0));
            }
            catch (err) {
                this._isRunning = false;
                this._displayError(logger, sock, err);
                resolve(4);
            }
        });
    }

    public async terminate(_that: ConsoleInterface, _sock: IChannelWrapper): Promise<void> {
        if (this._isRunning) {
            logEmitter.off('logmessage', this._messageWriter);
            this._sock = null;
            this._ew.EventSet();
            this._isRunning = false;
        }
    }
}
