export interface IApplication {
    validate(config: any): boolean;
    run(): Promise<boolean>;
    stop(): Promise<void>;
    get logging(): string;
    set logging(value: string);
    on?(eventName: string | symbol, listener: (...args: any[]) => void): void;
    once?(eventName: string | symbol, listener: (...args: any[]) => void): void;
    off?(eventName: String | symbol, listener: (...args: any[]) => void): void;
};