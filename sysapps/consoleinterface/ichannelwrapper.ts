import { TERMCOLOR } from ".";
import { IChannel } from "./ichannel";

export interface IChannelWrapper extends IChannel {
    write: (data: string | Buffer) => void;
    setColor: (color: TERMCOLOR) => void;
    writeColor: (color: TERMCOLOR, data: string | Buffer) => void;
    writeDefault: (data: string | Buffer) => void;
    writeRed: (data: string | Buffer) => void;
    writeGreen: (data: string | Buffer) => void;
    writeOrange: (data: string | Buffer) => void;
    writeBlue: (data: string | Buffer) => void;
    writeMagenta: (data: string | Buffer) => void;
    writeCyan: (data: string | Buffer) => void;
    writeLightBlue: (data: string | Buffer) => void;
    writeLightMagenta: (data: string | Buffer) => void;
    on: (name: string, ...args: any) => void;
    exit: (rc: number) => void;
    end: () => void;
    close: () => void;
}
