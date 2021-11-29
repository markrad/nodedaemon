export interface IChannel {
    write: (data: string | Buffer) => void;
    on: (name: string, ...args: any) => void;
    exit: (rc: number) => void;
    end: () => void;
    close: () => void;
}
