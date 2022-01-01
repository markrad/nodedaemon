import { getLogger } from "log4js";
import { AuthContext, Connection, Session, PseudoTtyInfo } from "ssh2";
import { ICommand } from "./icommand";
import { TransportSSH, User } from "./transportssh";
// import { ParsedKey, utils } from 'ssh2-streams';
import * as Crypto from 'crypto';
import ConsoleInterface from ".";
import { IChannel } from "./ichannel";
// import { ITransport } from "./itransport";

type Keys = {
    name: string;
    value: Buffer;
    action: (data?: Buffer) => void;
}

const CATEGORY: string = 'TransportSSHClient';
const logger = getLogger(CATEGORY);

export class TransportSSHClient {
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
                        let allowedPubKey: string = transport.AllowedPublicKeys[i].getPublicSSH();
                        if (ctx.key.algo == transport.AllowedPublicKeys[i].type ||
                            ctx.key.data.length === transport.AllowedPublicKeys.length ||
                            Crypto.timingSafeEqual(ctx.key.data, Buffer.from(allowedPubKey)) ||
                            (ctx.signature && transport.AllowedPublicKeys[i].verify(ctx.blob, ctx.signature) == true)) {
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
            .once('exec', (accept, _reject, info) => {
                try {
                    this._canStream = false;
                    let ending: boolean = false;
                    logger.debug(`Executing ${info.command}`);
                    let stream: IChannel = accept();
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
                let stream: IChannel = accept();
                this._canStream = true;
                stream.write("$ ");
                let len: number = 0;
                let cursor: number = 0;
                let history: string[] = [];
                let historyPointer: number = -1;
                let sig: boolean = false;
                const rightarrow: Buffer = Buffer.from([27, 91, 67]);
                const leftarrow: Buffer = Buffer.from([27, 91, 68]);
                const normal: string = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890';
                let tabCount: number = 0;
                let keys: Keys[] = [
                    {
                        name: "uparrow", value: Buffer.from([27, 91, 65]), action: () => {
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
                        name: "downarrow", value: Buffer.from([27, 91, 66]), action: () => {
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
                        name: "rightarrow", value: Buffer.from([27, 91, 67]), action: (data) => {
                            if (cursor < len) {
                                stream.write(data);
                                cursor++;
                            }
                        }
                    },
                    {
                        name: "leftarrow", value: Buffer.from([27, 91, 68]), action: (data) => {
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
                        name: "backspace", value: Buffer.from([127]), action: () => {
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
                        name: "tab", value: Buffer.from([9]), action: () => {
                            let allCmds: string[];
                            if (len == 0 || !sig) {
                                if (++tabCount > 1) {
                                    allCmds = this._commander.commands.map((cmd: ICommand) => cmd.commandName.padEnd(8));
                                    stream.write('\r\n');
                                    stream.write(`${allCmds.join('\t')}\r\n`);
                                    stream.write(`$ ${line.slice(0, len).toString()}`);
                                }
                            }
                            else {
                                let cmdWords: string[] = line.slice(0, cursor).toString().split(' ');
                                if (cmdWords.length == 1) {
                                    allCmds = this._commander.commands.filter((cmd: ICommand) => cmd.commandName.startsWith(cmdWords[0])).map((cmd: ICommand) => cmd.commandName);
                                    if (allCmds.length == 1) {
                                        let cursorAdjust: number = line.slice(cursor, len).toString().length;
                                        line = Buffer.concat([line.slice(0, cursor), Buffer.from(allCmds[0].substring(cmdWords[0].length)), line.slice(cursor)]);
                                        len += allCmds[0].length - cmdWords[0].length;
                                        stream.write(line.slice(cursor, len).toString());
                                        cursor += allCmds[0].length - cmdWords[0].length;
                                        while (cursorAdjust-- > 0) {
                                            stream.write(leftarrow);
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
                                                stream.write(`${possibles.map((poss) => poss.padEnd(8)).join('\t')}\r\n`);
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
                        }
                    },
                    {
                        name: "enter", value: Buffer.from([13]), action: async () => {
                            if (sig && len > 0) {
                                let cmd: string = line.toString().substr(0, len);
                                if (cmd == 'exit') {
                                    stream.write('\r\n');
                                    stream.exit(0);
                                    stream.close();
                                    return;
                                }
                                else {
                                    stream.write('\r\n');
                                    await this._commander.parseAndSend(this, stream, line.slice(0, len).toString());
                                    this.lastCommand = null;
                                }
                                if (history.length == 0 || cmd != history[0]) {
                                    history.unshift(cmd);
                                }
                            }
                            if (!sig) {
                                stream.write('\r\n');
                            }
                            stream.write('$ ');
                            len = 0;
                            cursor = 0;
                            sig = false;
                            historyPointer = -1;
                        }
                    },
                    { name: 'escape', value: Buffer.from([27]), action: () => { } },
                    {
                        name: 'ctrl-c', value: Buffer.from([3]), action: () => {
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
                const tab = Buffer.from([9]);
                stream.on('data', (data: Buffer) => {
                    if (Buffer.compare(tab, data) != 0) {
                        tabCount = 0;
                    }
                    if (this.lastCommand != null && Buffer.compare(Buffer.from([3]), data) != 0) {
                        return;
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