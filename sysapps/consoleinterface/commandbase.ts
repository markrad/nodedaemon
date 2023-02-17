import ConsoleInterface from ".";
import { IChannelWrapper } from "./ichannelwrapper";
import { ICommand } from './icommand';
import { Logger } from "log4js";

// type ParameterInfo = {
//     parameter: string;
//     description: string;
// }
type SubcommandInfo = {
    subcommandName: string;
    subcommandParm?: string;
    description: string;
    description2?: string;
    // parameters: ParameterInfo[];
}

export type CommandInfo = {
    commandName: string;
    subcommands: SubcommandInfo[];
}

export abstract class CommandBase implements ICommand {
    // private _commandName: string;
    // private _parameters: string[];
    private _commandInfo: CommandInfo;
    // public constructor(commandName: string, parameters?: string[]) {
    public constructor(commandInfo: CommandInfo) {
        this._commandInfo = commandInfo;
        // this._parameters = this._validateInputParameters(parameters);
    }

    // public abstract get helpText(): string;
    public abstract execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper, commands: ICommand[]): Promise<number>;

    public get helpTextx(): string {
        let ret: string = this._commandInfo.commandName.padEnd(8);
        this._commandInfo.subcommands.forEach((subcommand, index) => {
            ret += (index == 0? '' : ''.padEnd(8)) + (subcommand.subcommandName + ' ' + (subcommand.subcommandParm? subcommand.subcommandParm : '')).padEnd(24) + subcommand.description + '\r\n';
            if (subcommand.description2) ret += ''.padEnd(32) + subcommand.description2 + '\r\n';
        });
        return ret;
    }

    public terminate(_that: ConsoleInterface, _sock: IChannelWrapper): Promise<void> {
        return;
    }

    public get commandName(): string {
        return this._commandInfo.commandName;
    }

    public get parameters(): string[] {
        return this._commandInfo.subcommands.map((subcommand) => subcommand.subcommandName).filter((subcommand) => subcommand != '');
    }

    // public set parameters(value: string[]) {
    //     this._parameters = this._validateInputParameters(value);;
    // }

    protected _validateParameters(parameters: string[]): void {
        let parms = this.parameters;
        if (parms.length == 0) {
            if (parameters.length > 1) {
                throw new Error(`Command ${this.commandName} does not accept parameters`);
            }
        }
        else if (parameters.length > 1 && !parms.includes(parameters[1])) {
            throw new Error(`Command ${this.commandName} passed invalid parameter ${parameters[1]}`);
        }
    }

    public tabTargets(_that: ConsoleInterface, _tabCount: number, _parameters: string[]): string[] {
        // If the command accepts a target then this needs to be overriden in the child
        return [];
    }

    public tabParameters(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        if (parameters.length == 2) {
            if (this.parameters == null) {
                return [];
            }
            else {
                let possibles: string[] = this.parameters.filter((param) => param.startsWith(parameters[1]));

                if (possibles.length == 0 || (tabCount < 2 && possibles.length > 1)) {
                    return [];
                }
                else {
                    return possibles;
                }
            }
        }
        else {
            return this.tabTargets(that, tabCount, parameters);
        }
    }

    protected _validateInputParameters(parameters: string | string[]): string[] {
        if (!parameters) {
            return null;
        }

        if (!Array.isArray(parameters) && typeof(parameters) != 'string') {
            throw new Error('Parameters must be an array of strings');
        }

        return Array.isArray(parameters) ? parameters : [ parameters ];
    }

    protected _displayError(logger: Logger, sock: IChannelWrapper, err: Error) {
        logger.debug(`${err.message}`);
        sock.writeRed(`${err}\r\n`);
        sock.write('Usage:\r\n');
        sock.write(this.helpTextx);
        sock.write('\r\n');
    }
}
