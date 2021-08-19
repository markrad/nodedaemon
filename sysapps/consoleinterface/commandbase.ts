import { getLogger } from 'log4js';
import { ConsoleInterface, IChannel } from '.';
import { ICommand } from './ICommand';

const CATEGORY: string = 'CommandBase';
var logger = getLogger(CATEGORY);

export abstract class CommandBase implements ICommand {
    private _commandName: string;
    private _parameters: string[];
    constructor(commandName: string, parameters?: string[]) {
        this._commandName = commandName;
        this._parameters = this._validateInputParameters(parameters);
    }

    abstract get helpText(): string;
    abstract execute(inputArray: string[], that: ConsoleInterface, sock: IChannel, commands: ICommand[]): Promise<void>;

    get commandName(): string {
        return this._commandName;
    }

    get parameters(): string[] {
        return this._parameters;
    }

    set parameters(value: string[]) {
        this._parameters = this._validateInputParameters(value);;
    }

    validateParameters(parameters: string[]): void {
        if (this.parameters == null) {
            if (parameters.length > 1) {
                throw new Error(`Command ${this.commandName} does not accept parameters`);
            }
        }
        else if (this.parameters.indexOf(parameters[1]) == -1) {
            throw new Error(`Command ${this.commandName} passed invalid parameter ${parameters[1]}`);
        }
    }

    tabTargets(_that: ConsoleInterface, _tabCount: number, _parameters: string[]): string[] {
        // If the command accepts a target then this needs to be overriden in the child
        return [];
    }

    tabParameters(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
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

    _validateInputParameters(parameters: string | string[]): string[] {
        if (!parameters) {
            return null;
        }

        if (!Array.isArray(parameters) && typeof(parameters) != 'string') {
            throw new Error('Parameters must be an array of strings');
        }

        return Array.isArray(parameters) ? parameters : [ parameters ];
    }
}

// module.exports = CommandBase