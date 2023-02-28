import ConsoleInterface from ".";
import { IChannelWrapper } from "./ichannelwrapper";
import { CommandBase, CommandInfo } from "./commandbase";
import { getLogger, Logger } from "log4js";
import { EventWaiter } from "../../common/eventwaiter";

const CATEGORY: string = 'CommandEvents';
var logger: Logger = getLogger(CATEGORY);

const commandInfo: CommandInfo = {
    commandName: 'events',
    subcommands: [ 
        {
            subcommandName: '<not> <regex>',
            description: 'Follow events that match <regex> or don\'t match <not>'
        }
    ]
}

class CommandEvents extends CommandBase {
    private _isRunning: boolean = false;
    private _sock: IChannelWrapper = null;
    private _ew: EventWaiter = null;
    private messageWriter: any = null;
    public constructor() {
        super(commandInfo);
    }

    public get helpText(): string {
        return `${this.commandName}\t<not> <optional regex>\tFollow events that match <optional regex> or <not> match\r\n\t\t\t\tFor example events not state`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        return new Promise<number>((resolve, _reject) => {
            var regex: RegExp = null;
            var nonegator: boolean;
            this.messageWriter = (eventType: string, data: string) => 
            { 
                if (this._sock && (regex == null || !!regex.exec(eventType) === nonegator)) this._sock.write(`[${new Date().toISOString()}] Event: ${eventType}\r\n${JSON.stringify(data, null, 4).replace(/\n/g, '\r\n')}\r\n`); 
            }

            try {
                if (inputArray.length == 2) {
                    regex = new RegExp(inputArray[1])
                    nonegator = true;
                }
                else if (inputArray.length >= 3) {
                    if (inputArray[1].toLowerCase() != 'not') {
                        throw new Error('Parameter two must be \'not\' or a regular expression');
                    }
                    regex = new RegExp(inputArray[2]);
                    nonegator = false;
                }
                that.controller.on('serviceevent',  this.messageWriter)
                this._isRunning = true;
                this._sock = sock;
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

    public async terminate(that: ConsoleInterface, _sock: IChannelWrapper): Promise<void> {
        if (this._isRunning) {
            that.controller.off('serviceevent', this.messageWriter);
            this._sock = null;
            this._ew.EventSet();
            this._isRunning = false;
        }
    }
}

export const factory = new CommandEvents();