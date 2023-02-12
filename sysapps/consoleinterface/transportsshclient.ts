import { getLogger } from "log4js";
import { AuthContext, Connection, Session, PseudoTtyInfo, SetEnvInfo, ServerChannel, ExecInfo } from "ssh2";
import { ICommand } from "./icommand";
import { TransportSSH, User } from "./transportssh";
// import { ParsedKey, utils } from 'ssh2-streams';
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

    cursorInc() { return ++this._cursorPosition; }
    cursorDec() { return --this._cursorPosition; }
    get lineLength() { return this._lineLength; }
    get cursorPosition() { return this._cursorPosition; }
    set cursorPosition(value: number) { this._cursorPosition = value; }
    get lineContent() { return this._lineContent; }
    get cursorAtStart() { return this._cursorPosition == 0; }
    get cursorAtEnd() { return this._cursorPosition == this._lineLength; }
}

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
    // private _transport: ITransport
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
        let line: Buffer = Buffer.alloc(256);

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
                const rightarrow: Buffer = Buffer.from([27, 91, 67]);
                const leftarrow: Buffer = Buffer.from([27, 91, 68]);
                const uparrow: Buffer = Buffer.from([27, 91, 65]);
                const downarrow: Buffer = Buffer.from([27, 91, 66])
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
                let len: number = 0;
                let cursor: number = 0;
                let history: string[] = [];
                let historyPointer: number = -1;
                let sig: boolean = false;
                let tabCount: number = 0;
                let keys: Keys[] = [
                    {
                        name: "uparrow", value: uparrow, action: () => {
                            if (historyPointer + 1 < history.length) {
                                while (cursor < len) {
                                    stream.write(rightarrow);
                                    cursor++;
                                }
                                while (len > 0) {
                                    stream.write('\b \b');
                                    len--;
                                }
                                historyPointer++;
                                Buffer.from(history[historyPointer]).copy(line, 0, 0);
                                cursor = len = history[historyPointer].length;
                                line[len] = 0;
                                stream.write(line.slice(0, len));
                                sig = true;
                            }
                        }
                    },
                    {
                        name: "downarrow", value: downarrow, action: () => {
                            while (cursor < len) {
                                stream.write(rightarrow);
                                cursor++;
                            }
                            while (len > 0) {
                                stream.write('\b \b');
                                len--;
                            }
                            if (historyPointer >= 0) {
                                historyPointer--;
                                if (historyPointer >= 0) {
                                    Buffer.from(history[historyPointer]).copy(line, 0, 0);
                                    cursor = len = history[historyPointer].length;
                                    line[len] = 0;
                                    stream.write(line.slice(0, len));
                                    sig = true;
                                }
                                else {
                                    cursor = 0;
                                }
                            }
                        }
                    },
                    {
                        name: "rightarrow", value: rightarrow, action: (data) => {
                            if (cursor < len) {
                                stream.write(data);
                                cursor++;
                            }
                        }
                    },
                    {
                        name: "leftarrow", value: leftarrow, action: (data) => {
                            if (cursor > 0) {
                                stream.write(data);
                                cursor--;
                            }
                        }
                    },
                    {
                        name: "ctrlrightarrow", value: Buffer.from([27, 91, 49, 59, 53, 67]), action: () => {
                            if (cursor < len) {
                                do {
                                    cursor++;
                                    stream.write(rightarrow);
                                } while (cursor < len && normal.includes(String.fromCharCode(line[cursor])))
                            }
                        }
                    },
                    {
                        name: "ctrlleftarrow", value: Buffer.from([27, 91, 49, 59, 53, 68]), action: () => {
                            if (cursor > 0) {
                                do {
                                    cursor--;
                                    stream.write(leftarrow);
                                } while (cursor > 0 && normal.includes(String.fromCharCode(line[cursor - 1])))
                            }
                        }
                    },
                    {
                        name: "backspace", value: backspace, action: () => {
                            if (len > 0 && cursor != 0) {
                                stream.write('\b \b');
                                if (cursor < len) {
                                    stream.write(line.slice(cursor, len));
                                    stream.write(' ');
                                    for (let i = 0; i < len - cursor + 1; i++) {
                                        stream.write(leftarrow);
                                    }
                                    line.copy(line, cursor - 1, cursor, len);
                                }
                                len--;
                                cursor--;
                            }
                        }
                    },
                    {
                        name: "delete", value: Buffer.from([27, 91, 51, 126]), action: () => {
                            if (cursor < len) {
                                stream.write(' \b');
                                if (cursor < len - 1) {
                                    stream.write(line.slice(cursor + 1, len));
                                    stream.write(' ');
                                    for (let i = len; i > cursor; i--) {
                                        stream.write(leftarrow);
                                    }
                                    line.copy(line, cursor, cursor + 1, len);
                                }
                                len--;
                            }
                        }
                    },
                    {
                        name: "home", value: Buffer.from([27, 91, 49, 126]), action: () => {
                            while (cursor--) {
                                stream.write(leftarrow);
                            }
                            cursor++;
                        }
                    },
                    {
                        name: "end", value: Buffer.from([27, 91, 52, 126]), action: () => {
                            while (++cursor < len + 1) {
                                stream.write(rightarrow);
                            }
                            cursor--;
                        }
                    },
                    {
                        name: "tab", value: tab, action: () => {
                            // BUG does not work if line has leading blanks
                            let allCmds: string[];
                            let cmdWords: string[] = line.slice(0, cursor).toString().split(' ');
                            if (len == 0 || cmdWords.length == 1 || !sig) {
                                if (++tabCount > 1) {
                                    allCmds = this._commander.commands.map((cmd: ICommand) => cmd.commandName).filter((cmd) => cmd.startsWith(cmdWords[0])).sort();
                                    switch (allCmds.length) {
                                        case 0:
                                            break;
                                        case 1:
                                            let cursorAdjust: number = allCmds[0].length - cmdWords[0].length;
                                            line = Buffer.concat([line.slice(0, cursor), Buffer.from(allCmds[0].slice(0 - cursorAdjust))]);
                                            stream.write(`${line.slice(0 - cursorAdjust)} `);
                                            cursor += ++cursorAdjust;
                                            len = cursor;
                                            // while (cursorAdjust-- > 0) {
                                            //     stream.write(rightarrow);
                                            // }
                                            break;
                                        default:
                                            stream.write('\r\n');
                                            stream.write(`${allCmds.map((cmd) => cmd.padEnd(8)).join('\t')}\r\n`);
                                            stream.write(`$ ${line.slice(0, len).toString()}`);
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
                                            let cursorAdjust: number = line.slice(cursor, len).toString().length;
                                            line = Buffer.concat([line.slice(0, cursor), Buffer.from(possibles[0].substring(cmdWords[cmdWords.length - 1].length)), line.slice(cursor)]);
                                            len += possibles[0].length - cmdWords[cmdWords.length - 1].length;
                                            stream.write(line.slice(cursor, len).toString());
                                            cursor += possibles[0].length - cmdWords[cmdWords.length - 1].length;
                                            while (cursorAdjust-- > 0) {
                                                stream.write(leftarrow);
                                            }
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
                                            let lastLen: number = cmdWords[cmdWords.length - 1].length;
                                            line = Buffer.concat([line.slice(0, len), Buffer.from(possibles[0].substr(lastLen, resultLen - lastLen)), line.slice(len)]);
                                            len += resultLen - lastLen;
                                            cursor += resultLen - lastLen;
                                            stream.write(`$ ${line.slice(0, len).toString()}`);
                                            break;
                                    }
                                }
                            }
                        }
                    },
                    {
                        name: "enter", value: enter, action: async () => {
                            if (sig && len > 0) {
                                let cmd: string = line.toString().slice(0, len).trim(); 
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
                                if (history.length == 0 || cmd != history[0]) {
                                    history.unshift(cmd);
                                }
                            }
                            else if (!sig) {
                                stream.write('\r\n');
                            }
                            stream.write('$ ');
                            len = 0;
                            cursor = 0;
                            sig = false;
                            historyPointer = -1;
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
                                len = 0;
                                cursor = 0;
                                sig = false;
                                historyPointer = -1;
                            }
                        }
                    },
                ];
                stream.on('data', (data: Buffer) => {
                    if (Buffer.compare(tab, data) != 0) {
                        tabCount = 0;
                    }
                    // BUG I don't think this does anything
                    // if (this.lastCommand != null && Buffer.compare(ctrlc, data) != 0) {
                    //     return;
                    // }
                    let handled = keys.find(key => Buffer.compare(key.value, data) == 0);
                    if (handled) {
                        handled.action(data);
                    }
                    else if (data.length > 1) {
                        // Ignore other special characters
                        logger.debug(`Unknown key ${data.join(',')}`);
                    }
                    else {
                        if (len == cursor) {
                            line.writeUInt8(data[0], len++);
                            if (data[0] != 9 && data[0] != 32) {
                                sig = true;
                            }
                            if (data[0] != 9 && data.length == 1) {
                                stream.write(data);
                            }
                        }
                        else {
                            line.copy(line, cursor + 1, cursor, len);
                            line[cursor] = data[0];
                            stream.write(line.slice(cursor, len + 1));
                            for (let i = 0; i < len - cursor; i++) {
                                stream.write(leftarrow);
                            }
                            len++;
                        }
                        cursor++;
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