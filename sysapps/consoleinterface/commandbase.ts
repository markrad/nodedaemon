import ConsoleInterface from ".";
import { IChannelWrapper } from "./ichannelwrapper";
import { ICommand } from './icommand';
import { Logger } from "log4js";

export abstract class CommandBase implements ICommand {
    private _commandName: string;
    private _parameters: string[];
    public constructor(commandName: string, parameters?: string[]) {
        this._commandName = commandName;
        this._parameters = this._validateInputParameters(parameters);
    }

    public abstract get helpText(): string;
    public abstract execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper, commands: ICommand[]): Promise<void>;

    public terminate(_that: ConsoleInterface, _sock: IChannelWrapper): Promise<void> {
        return;
    }

    public get commandName(): string {
        return this._commandName;
    }

    public get parameters(): string[] {
        return this._parameters;
    }

    public set parameters(value: string[]) {
        this._parameters = this._validateInputParameters(value);;
    }

    protected _validateParameters(parameters: string[]): void {
        if (this.parameters == null) {
            if (parameters.length > 1) {
                throw new Error(`Command ${this.commandName} does not accept parameters`);
            }
        }
        else if (this.parameters.indexOf(parameters[1]) == -1) {
            throw new Error(`Command ${this.commandName} passed invalid parameter ${parameters[1]?? '<missing>'}`);
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
        sock.write(this.helpText);
        sock.write('\r\n');
    }
}
