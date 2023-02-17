import ConsoleInterface from ".";
import { IChannelWrapper } from "./ichannelwrapper";

export interface ICommand {
    get commandName(): string;
    get parameters(): string[];
    set parameters(parameters: string[]);
    tabTargets(that: ConsoleInterface, tabCount: number, parameters: string[]): string[]
    tabParameters(that: any, tabCount: any, parameters: any): string[];
    get helpTextx(): string;
    execute(inputArray: string[], that: any, sock: IChannelWrapper, commands: ICommand[]): Promise<number>;
    terminate(that: ConsoleInterface, sock: IChannelWrapper): Promise<void>;
}