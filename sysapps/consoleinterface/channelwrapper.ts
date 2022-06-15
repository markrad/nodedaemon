import { IChannel } from "./ichannel";
import { TERMCOLOR } from ".";

export class ChannelWrapper implements IChannel {
    private _channel: IChannel;
    private _color: TERMCOLOR;
    constructor(channel: IChannel) {
        this._channel = channel;
        this._color = TERMCOLOR.DEFAULT;
    }
    setColor(color: TERMCOLOR): void {
        this.write(color);
        this._color = color;
    }

    writeColor(color: TERMCOLOR, data: string | Buffer): void {
        this.write(`${color}`);
        this.write(data);
        this.write(this._color);
    }

    writeDefault(data: string | Buffer): void {
        this.writeColor(TERMCOLOR.DEFAULT, data);
    }

    writeRed(data: string | Buffer): void {
        this.writeColor(TERMCOLOR.RED, data);
    }

    writeGreen(data: string | Buffer): void {
        this.writeColor(TERMCOLOR.GREEN, data);
    }

    writeBlue(data: string | Buffer): void {
        this.writeColor(TERMCOLOR.BLUE, data);
    }

    writeLightBlue(data: string | Buffer): void {
        this.writeColor(TERMCOLOR.LIGHT_BLUE, data);
    }

    write(data: string | Buffer): void {
        this._channel.write(data);
    }

    on(name: string, ...args: any): void {
        this._channel.on(name, ...args);
    }

    exit(rc: number): void {
        this._channel.exit(rc);
    }

    end(): void {
        this._channel.end();
    }

    close(): void {
        this._channel.close();
    }
}