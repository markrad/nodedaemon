export interface IApplication {
    validate(config: any): boolean;
    run(): Promise<boolean>;
    stop(): void;
    get logging(): string;
    set logging(value: string);
};