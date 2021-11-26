import { ConsoleInterface } from ".";
import { IChannel } from "./ichannel";

export interface ICommand {
    get commandName(): string;
    get parameters(): string[];
    set parameters(parameters: string[]);
    tabTargets(that: ConsoleInterface, tabCount: number, parameters: string[]): string[]
    tabParameters(that: any, tabCount: any, parameters: any): string[];
    get helpText(): string;
    execute(inputArray: string[], that: any, sock: IChannel, commands: ICommand[]): Promise<void>;
    terminate(that: ConsoleInterface, sock: IChannel): Promise<void>;
}