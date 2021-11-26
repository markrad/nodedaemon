export interface ITransport {
    start(): Promise<void>;
    stop(): Promise<void>;
    // lastCommand();
}
