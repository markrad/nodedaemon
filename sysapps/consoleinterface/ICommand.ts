interface ICommand {
    get commandName(): string;
    get parameters(): string[];
    set parameters(parameters: string[]);
    validateParameters(parameters: string[]): void;
    // TODO type these parameters with any
    tabTargets(that: any, tabCount: any, parameters: any): string[];
    tabParameters(that: any, tabCount: any, parameters: any): string[];
    _validateInputParameters(parameters: string | string[]): string[];
    get helpText(): string;
    execute(inputArray: string[], that: any, sock: any): void;
}