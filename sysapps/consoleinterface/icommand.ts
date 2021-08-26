import { ConsoleInterface } from ".";

export interface ICommand {
    get commandName(): string;
    get parameters(): string[];
    set parameters(parameters: string[]);
    tabTargets(that: ConsoleInterface, tabCount: number, parameters: string[]): string[]
    tabParameters(that: any, tabCount: any, parameters: any): string[];
    get helpText(): string;
    execute(inputArray: string[], that: any, sock: any, commands: ICommand[]): Promise<void>;
}