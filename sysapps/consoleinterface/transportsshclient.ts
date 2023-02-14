import { getLogger } from "log4js";
import { AuthContext, Connection, Session, PseudoTtyInfo, SetEnvInfo, ServerChannel, ExecInfo } from "ssh2";
import { ICommand } from "./icommand";
import { TransportSSH, User } from "./transportssh";
import * as Crypto from 'crypto';
import ConsoleInterface from ".";
import { IChannelWrapper } from "./ichannelwrapper";
import { ChannelWrapper } from "./channelwrapper";

type Keys = {
    name: string;
    value: Buffer;
    action: (data?: Buffer) => void;
}

class Console {
    private _lineLength: number = 0;
    private _cursorPosition: number = 0;
    private _lineContent: Buffer = Buffer.alloc(256);

    constructor (lineLength: number, cursorPosition: number, lineContent?: string) {
        if (lineLength) this._lineLength = lineLength;
        if (cursorPosition) this.cursorPosition = cursorPosition;
        if (lineContent) this._lineContent.write(lineContent);
    }
    lineInsertByte(data: number, location: number): number {
        if (location > this.lineLength) throw new Error(`Value ${location} is beyond the data buffer`);
        if (location < this.lineLength) {
            this._lineContent.copy(this._lineContent, location + 1, location)
        }
        this._lineContent.writeInt8(data, location);
        this._lineLength++;
        // this.linePreInc();
        return this.lineLength;
    }
    lineAppendByte(data: number): number {
        return this.lineInsertByte(data, this.lineLength);
    }
    lineAppendString(data: string): number {
        this._lineContent.write(data, this.lineLength);
        this._lineLength += data.length;
        return this.lineLength;
    }
    lineInsertAtCursor(data: number): number {
        return this.lineInsertByte(data, this.cursorPosition);
    }
    lineRemoveByte(location: number) {
        if (location >= this.lineLength) throw new Error(`Location is out of range ${location}`);
        this.lineContent.copy(this._lineContent, location, location + 1);
        this._lineLength--;
        // this.linePreDec();
    }
    reset(): void {
        this._lineLength = 0;
        this.cursorPosition = 0;
    }
    setlineContent(content: string) {
        this._lineContent.write(content);
        this._lineLength = content.length; 
    }
    get lineLength(): number { return this._lineLength; }
    // set lineLength(value) { this._lineLength = value }
    get cursorPosition(): number { return this._cursorPosition; }
    set cursorPosition(value: number) { this._cursorPosition = value; }
    get lineContent(): Buffer { return this._lineContent; }
    get lineAsString(): string { return this.lineContent.slice(0, this.lineLength).toString() }
    get cursorAtStart(): boolean { return this._cursorPosition == 0; }
    get cursorAtEnd(): boolean { return this._cursorPosition == this._lineLength; }
}
Console;

class History {
    private _entries: string[] = [ ];
    private _ptr: number = -1;

    addEntry(entry: string): number {
        if (entry != this._entries[0]) this._entries.unshift(entry);
        this._ptr = -1;
        return this._entries.length;
    }

    reset(): void {
        this._ptr = -1;
    }

    get previousEntry(): string {
        return this._entries.length == 0
        ? '' 
        : this._entries.length - 1 == this._ptr
        ? this._entries[this._ptr] 
        : this._entries[++this._ptr];
    }

    get nextEntry(): string {
        this._ptr = Math.max(0, this._ptr - 1);
        return this._entries.length == 0
        ? ''
        : this._ptr == -1
        ? ''
        : this._entries[this._ptr];
    }
}

History;

const CATEGORY: string = 'TransportSSHClient';
const logger = getLogger(CATEGORY);

export class TransportSSHClient {
    static LOGO: string = `
             |         |\r
___  ___  ___| ___  ___| ___  ___  _ _  ___  ___\r
|   )|   )|   )|___)|   )|   )|___)| | )|   )|   )\r
|  / |__/ |__/ |__  |__/ |__/||__  |  / |__/ |  /\r
`;
    private _client: Connection = null;
    private _canStream: boolean = false;
    private _lastCommand: ICommand = null;
    private _commander: ConsoleInterface;
    constructor(client: Connection) {
        this._client = client;
        logger.info('New client connected');
    }

    start(transport: TransportSSH, commander: ConsoleInterface) {
        this._commander = commander;
        // this._transport = transport;
        this._client
        .on('authentication', (ctx: AuthContext) => {
            var user: Buffer = Buffer.from(ctx.username);
            let found: User = transport.Users.find((entry) => {
                return entry.userid.length == user.length && Crypto.timingSafeEqual(user, entry.userid);
            });
            if (!found) {
                return ctx.reject();
            }

            switch (ctx.method) {
                case 'password':
                    let password: Buffer = Buffer.from(ctx.password);
                    if (password.length != found.password.length || !Crypto.timingSafeEqual(password, found.password)) {
                        return ctx.reject();
                    }
                break;
                case 'publickey':
                    let i;
                    for (i = 0; i < transport.AllowedPublicKeys.length; i++) {
                        let allowedPubKey: Buffer = Buffer.from(transport.AllowedPublicKeys[i].getPublicSSH());
                        if (ctx.key.algo == transport.AllowedPublicKeys[i].type &&
                            ctx.key.data.length === allowedPubKey.length &&
                            Crypto.timingSafeEqual(ctx.key.data, allowedPubKey) &&
                            (ctx.signature == undefined || transport.AllowedPublicKeys[i].verify(ctx.blob, ctx.signature) == true)) {
                            break;
                        }
                    }

                    if (i == transport.AllowedPublicKeys.length) return ctx.reject();
                break;
                case 'none':
                    return ctx.reject();
                case 'keyboard-interactive':
                    return ctx.reject();
                default:
                    logger.warn(`Unknown authentication type: ${ctx.method}`);
                    return ctx.reject();
            }

            logger.info(`Client authenticated: ${user}`);
            ctx.accept();
        })
        .on('end', () => {
            logger.info('Client disconnected');
        })
        .on('error', (err: Error) => {
            if ((err as any).errno != -104) {
                logger.error(`Connection error: ${err}`);
            }
        })
        .on('ready', () => {
            this._client.once('session', (accept: () => Session, _reject: boolean) => {
                this.newSession(commander, accept())
           });
        });
    }

    newSession(commander: ConsoleInterface, session: Session) {
        // let line: Buffer = Buffer.alloc(256);

        session
            .on('pty', (accept: () => boolean, _reject: () => boolean, _req: PseudoTtyInfo) => {
                accept();
            })
            .on('env', (_accept, _reject, _info: SetEnvInfo) => {
                logger.warn('env request ignored');
            })
            .on('sftp', (_accept: () => ServerChannel, _reject: () => boolean, _info: ExecInfo) => {
                logger.warn('sftp request ignored');
            })
            .once('exec', (accept, _reject, info) => {
                try {
                    this._canStream = false;
                    let ending: boolean = false;
                    logger.debug(`Executing ${info.command}`);
                    let stream: IChannelWrapper = new ChannelWrapper(accept(), false);
                    stream.on('error', (err: Error) => {
                        if (!ending) {
                            logger.warn(`Stream failed: ${err}`)
                        }
                    });
                    commander.parseAndSend(this, stream, info.command);
                    stream.exit(0);    
                    ending = true;
                    stream.end();
                }
                catch (err) {
                    logger.error(`Exception caught: ${err}`);
                }
            })
            .once('shell', (accept, _reject, _info) => {
                const uparrow: Buffer = Buffer.from([27, 91, 65]);
                const downarrow: Buffer = Buffer.from([27, 91, 66])
                const rightarrow: Buffer = Buffer.from([27, 91, 67]);
                const leftarrow: Buffer = Buffer.from([27, 91, 68]);
                const ctrlrightarrow: Buffer = Buffer.from([27, 91, 49, 59, 53, 67]);
                const ctrlleftarrow: Buffer = Buffer.from([27, 91, 49, 59, 53, 68]);
                const end: Buffer = Buffer.from([27, 91, 70]);
                const home: Buffer = Buffer.from([27, 91, 72]);
                const backspace: Buffer = Buffer.from([127]);
                const tab: Buffer = Buffer.from([9]);
                const ctrlc: Buffer = Buffer.from([3]);
                const enter: Buffer = Buffer.from([13]);
                const escape: Buffer = Buffer.from([27]);
                const normal: string = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890';

                let stream: IChannelWrapper = new ChannelWrapper(accept());
                this._canStream = true;
                stream.writeGreen(TransportSSHClient.LOGO + '\n');
                stream.writeDefault(`\nVersion: ${this._commander.controller.version}\r\n`);
                stream.writeDefault("$ ");
                let sig: boolean = false;
                let tabCount: number = 0;
                let console = new Console(0, 0);
                let history: History = new History();
                let keys: Keys[] = [
                    {
                        name: "uparrow", value: uparrow, action: () => {
                            let newLine = history.previousEntry;
                            while (!console.cursorAtEnd) {
                                stream.write(rightarrow);
                                ++console.cursorPosition;
                            }
                            while (console.lineLength > 0) {
                                stream.write('\b \b');
                                console.lineRemoveByte(console.lineLength - 1);
                            }
                            console.setlineContent(newLine);
                            console.cursorPosition = newLine.length;
                            stream.write(console.lineContent.slice(0, console.lineLength));
                            sig = true;
                        }
                    },
                    {
                        name: "downarrow", value: downarrow, action: () => {
                            let newLine = history.nextEntry;
                            if (newLine.length > 0) {
                                while (!console.cursorAtEnd) {
                                    stream.write(rightarrow);
                                    ++console.cursorPosition;
                                }
                                while (console.lineLength > 0) {
                                    stream.write('\b \b');
                                    console.lineRemoveByte(console.lineLength - 1);
                                }
                                console.setlineContent(newLine);
                                console.cursorPosition = newLine.length;
                                stream.write(console.lineContent.slice(0, console.lineLength));
                                sig = true;
                            }
                        }
                    },
                    {
                        name: "rightarrow", value: rightarrow, action: (data) => {
                            if (!console.cursorAtEnd) {
                                stream.write(data);
                                ++console.cursorPosition;
                            }
                        }
                    },
                    {
                        name: "leftarrow", value: leftarrow, action: (data) => {
                            if (!console.cursorAtStart) {
                                stream.write(data);
                                --console.cursorPosition;
                            }
                        }
                    },
                    {
                        name: "ctrlrightarrow", value: ctrlrightarrow, action: () => {
                            if (!console.cursorAtEnd) {
                                do {
                                    ++console.cursorPosition;
                                    stream.write(rightarrow);
                                } while (!console.cursorAtEnd && normal.includes(console.lineAsString[console.cursorPosition]));       //(String.fromCharCode(line[cursor])))
                            }
                        }
                    },
                    {
                        name: "ctrlleftarrow", value: ctrlleftarrow, action: () => {
                            if (!console.cursorAtStart) {
                                do {
                                    --console.cursorPosition;
                                    stream.write(leftarrow);
                                } while (!console.cursorAtStart && normal.includes(console.lineAsString[console.cursorPosition - 1]));  // (String.fromCharCode(line[cursor - 1])))
                            }
                        }
                    },
                    {
                        name: "backspace", value: backspace, action: () => {
                            if (console.lineLength > 0 && !console.cursorAtStart) {
                                stream.write('\b \b');
                                stream.write(console.lineContent.slice(console.cursorPosition, console.lineLength));
                                stream.write(' ');
                                for (let i = 0; i < console.lineLength - console.cursorPosition + 1; i++) {
                                    stream.write(leftarrow);
                                }
                                console.lineRemoveByte(console.cursorPosition - 1);
                                --console.cursorPosition;
                            }
                        }
                    },
                    {
                        name: "delete", value: Buffer.from([27, 91, 51, 126]), action: () => {
                            if (console.lineLength > 0 && !console.cursorAtEnd) {
                                stream.write(' \b');
                                stream.write(console.lineContent.slice(console.cursorPosition + 1));
                                stream.write(' ');
                                for (let i = console.lineLength; i > console.cursorPosition; i--) {
                                    stream.write(leftarrow);
                                }
                                console.lineRemoveByte(console.cursorPosition);
                            }
                        }
                    },
                    {
                        name: "home", value: home, action: () => {
                            while (console.cursorPosition--) {
                                stream.write(leftarrow);
                            }
                            ++console.cursorPosition;
                        }
                    },
                    {
                        name: "end", value: end, action: () => {
                            while (++console.cursorPosition < console.lineLength + 1) {
                                stream.write(rightarrow);
                            }
                            --console.cursorPosition;
                        }
                    },
                    {
                        name: "tab", value: tab, action: () => {
                            // BUG does not work if line has leading blanks
                            let allCmds: string[];
                            let cmdWords: string[] = console.lineAsString.split(' ');
                            if (console.lineLength == 0 || cmdWords.length == 1 || !sig) {
                                if (++tabCount > 1) {
                                    allCmds = this._commander.commands.map((cmd: ICommand) => cmd.commandName).filter((cmd) => cmd.startsWith(cmdWords[0])).sort();
                                    switch (allCmds.length) {
                                        case 0:
                                            break;
                                        case 1:
                                            let saveLen = console.lineLength;
                                            while (!console.cursorAtEnd) {
                                                stream.write(rightarrow);
                                                console.cursorPosition++;
                                            }
                                            console.lineAppendString(allCmds[0].slice(saveLen));
                                            console.lineAppendString(' ');
                                            stream.write(console.lineContent.slice(saveLen, console.lineLength));
                                            console.cursorPosition = console.lineLength;
                                            break;
                                        default:
                                            stream.write('\r\n');
                                            stream.write(`${allCmds.map((cmd) => cmd.padEnd(8)).join('\t')}\r\n`);
                                            stream.write(`$ ${console.lineContent.slice(0, console.lineLength).toString()}`);
                                            break;
                                    }
                                }
                            }
                            else {
                                let command: ICommand = this._commander.commands.find((cmd: ICommand) => cmd.commandName == cmdWords[0].toLowerCase());
                                if (command) {
                                    let possibles: string[] = command.tabParameters(this._commander, ++tabCount, cmdWords);
                                    switch (possibles.length) {
                                        case 0:
                                            break;
                                        case 1:
                                            let saveLen = console.lineLength;
                                            while (!console.cursorAtEnd) {
                                                stream.write(rightarrow);
                                                console.cursorPosition++;
                                            }
                                            console.lineAppendString(possibles[0].substring(cmdWords[cmdWords.length - 1].length));
                                            console.lineAppendString(' ');
                                            stream.write(console.lineContent.slice(saveLen, console.lineLength));
                                            console.cursorPosition = console.lineLength;
                                            break;
                                        default:
                                            let resultLen = possibles[0].length;
                                            let curr: number;
                                            for (let i: number = 1; i < possibles.length; i++) {
                                                curr = 0;
                                                while (curr < resultLen && curr < possibles[i].length && possibles[0][curr] == possibles[i][curr]) {
                                                    curr++;
                                                }
                                                resultLen = curr;
                                            }
                                            
                                            stream.write('\r\n');
                                            stream.writeLightMagenta(`${possibles.map((poss) => poss.padEnd(8)).join('\t')}\r\n`);
                                            stream.write('$ ');
                                            stream.write(console.lineContent.slice(0, console.lineLength));
                                            console.cursorPosition = console.lineLength;
                                            break;
                                    }
                                }
                            }
                        }
                    },
                    {
                        name: "enter", value: enter, action: async () => {
                            if (sig && console.lineLength) {
                                let cmd: string = console.lineAsString.trim(); 
                                if (cmd == 'exit') {
                                    stream.write('\r\n');
                                    stream.exit(0);
                                    stream.close();
                                    return;
                                }
                                else {
                                    stream.write('\r\n');
                                    await this._commander.parseAndSend(this, stream, cmd);
                                    this.lastCommand = null;
                                }
                                history.addEntry(cmd);
                            }
                            else if (!sig) {
                                stream.write('\r\n');
                            }
                            stream.write('$ ');
                            console.reset();
                            sig = false;
                        }
                    },
                    { name: 'escape', value: escape, action: () => { } },
                    {
                        name: 'ctrl-c', value: ctrlc, action: () => {
                            if (this.lastCommand){
                                this.lastCommand.terminate(this._commander, stream);
                            }
                            else {
                                stream.write('^C\r\n$ ');
                                console.reset()
                                history.reset();
                                sig = false;
                            }
                        }
                    },
                ];
                stream.on('data', (data: Buffer) => {
                    if (Buffer.compare(tab, data) != 0) {
                        tabCount = 0;
                    }
                    let handled = keys.find(key => Buffer.compare(key.value, data) == 0);
                    if (handled) {
                        handled.action(data);
                    }
                    else if (data.length > 1) {
                        // Ignore other special characters
                        logger.debug(`Unknown key ${data.join(',')}`);
                    }
                    else {
                        console.lineInsertAtCursor(data[0]);
                        stream.write(console.lineContent.slice(console.cursorPosition, console.lineLength));
                        ++console.cursorPosition;
                        for (let i = 0; i < console.lineLength - console.cursorPosition; i++) {
                            stream.write(leftarrow);
                        }
                        if (data[0] != 32) sig = true;
                    }
                });
            });
    }
    get canStream() {
        return this._canStream;
    }

    get lastCommand() {
        return this._lastCommand;
    }

    set lastCommand(value: ICommand) {
        this._lastCommand = value;
    }
}