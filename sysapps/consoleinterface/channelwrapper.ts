import { IChannel } from "./ichannel";
import { TERMCOLOR } from ".";

export class ChannelWrapper implements IChannel {
    private _channel: IChannel;
    private _color: TERMCOLOR;
    private _useColor: boolean;
    constructor(channel: IChannel, useColor: boolean = true) {
        this._channel = channel;
        this._color = TERMCOLOR.DEFAULT;
        this._useColor = useColor;
    }
    setColor(color: TERMCOLOR): void {
        if (this._useColor) {
            this.write(color);
            this._color = color;
        }
    }

    writeColor(color: TERMCOLOR, data: string | Buffer): void {
        if (this._useColor) { 
            this.write(`${color}`);
            this.write(data);
            this.write(this._color);
        }
        else {
            this.write(data);
        }
    }

    writeDefault(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.DEFAULT, data);
        else this.write(data);
    }

    writeRed(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.RED, data);
        else this.write(data);
    }

    writeGreen(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.GREEN, data);
        else this.write(data);
    }

    writeOrange(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.ORANGE, data);
        else this.write(data);
    }

    writeBlue(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.BLUE, data);
        else this.write(data);
    }

    writeMagenta(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.MAGENTA, data);
        else this.write(data);
    }

    writeCyan(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.CYAN, data);
        else this.write(data);
    }

    writeLightBlue(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.LIGHT_BLUE, data);
        else this.write(data);
    }

    writeLightMagenta(data: string | Buffer): void {
        if (this._useColor) this.writeColor(TERMCOLOR.LIGHT_MAGENTA, data);
        else this.write(data);
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