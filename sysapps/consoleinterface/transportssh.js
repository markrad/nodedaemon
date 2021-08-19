"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const Crypto = __importStar(require("crypto"));
const path_1 = __importDefault(require("path"));
const ssh2_1 = require("ssh2");
const log4js_1 = require("log4js");
const CATEGORY = 'TransportSSH';
var logger = log4js_1.getLogger(CATEGORY);
class TransportSSH {
    constructor(name, parent, commands, config) {
        this._name = name;
        this._parent = parent;
        this._host = (config === null || config === void 0 ? void 0 : config.ssh.host) || '0.0.0.0';
        this._port = (config === null || config === void 0 ? void 0 : config.ssh.port) || 8822;
        this._commands = commands;
        this._users = [];
        this._server = null;
        if (!(config === null || config === void 0 ? void 0 : config.ssh.certFile) || !(config === null || config === void 0 ? void 0 : config.ssh.keyFile)) {
            throw new Error('Required certificate or key file locations are missing');
        }
        if (!(config === null || config === void 0 ? void 0 : config.ssh.users) || typeof (config.ssh.users) != 'object' || Array.isArray(config.ssh.users) == false) {
            throw new Error('No userids were provided');
        }
        config.ssh.users.forEach((user) => {
            if (!user.userid || !user.password) {
                throw new Error('Incorrect format for userids');
            }
            this._users.push({ userid: Buffer.from(user.userid), password: Buffer.from(user.password) });
        });
        let cert = config.ssh.certFile;
        let key = config.ssh.keyFile;
        if (!path_1.default.isAbsolute(cert)) {
            cert = path_1.default.join(__dirname, cert);
        }
        if (!path_1.default.isAbsolute(key)) {
            key = path_1.default.join(__dirname, key);
        }
        this._allowdPubKey = ssh2_1.utils.parseKey(fs_1.default.readFileSync(cert));
        this._hostKey = fs_1.default.readFileSync(key);
    }
    _parseAndSend(stream, cmd, interactive = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (interactive) {
                stream.write('\r\n');
            }
            let words = cmd.trim().split(' ');
            let command = this._commands.find((entry) => entry.commandName == words[0].toLowerCase());
            if (!command) {
                stream.write(`Unknown command: ${words[0]}\r\n`);
            }
            else {
                command.execute(words, this._parent, stream);
            }
        });
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            this._server = new ssh2_1.Server({ hostKeys: [this._hostKey] }, (client) => {
                logger.info('New client connected');
                client
                    .on('authentication', (ctx) => {
                    var user = Buffer.from(ctx.username);
                    let found = this._users.find((entry) => {
                        return entry.userid.length == user.length && Crypto.timingSafeEqual(user, entry.userid);
                    });
                    if (!found) {
                        return ctx.reject();
                    }
                    switch (ctx.method) {
                        case 'password':
                            let password = Buffer.from(ctx.password);
                            if (password.length != found.password.length || !Crypto.timingSafeEqual(password, found.password)) {
                                return ctx.reject();
                            }
                            break;
                        case 'publickey':
                            let allowedPubKey = this._allowdPubKey.getPublicSSH();
                            if (ctx.key.algo != allowedPubKey.type ||
                                ctx.key.data.length !== allowedPubKey.length ||
                                !Crypto.timingSafeEqual(ctx.key.data, allowedPubKey) ||
                                (ctx.signature && allowedPubKey.verify(ctx.blob, ctx.signature) != true)) {
                                return ctx.reject();
                            }
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
                    .on('error', (err) => {
                    if (err.errno != -104) {
                        logger.error(`Connection error: ${err}`);
                    }
                })
                    .on('ready', () => {
                    client.on('session', (accept, _reject) => {
                        let session = accept();
                        let line = Buffer.alloc(256);
                        session
                            .on('pty', (accept, _reject, _req) => {
                            accept();
                        })
                            .once('exec', (accept, _reject, info) => {
                            try {
                                let ending = false;
                                logger.debug(`Executing ${info.command}`);
                                let stream = accept();
                                stream.on('error', (err) => {
                                    if (!ending) {
                                        logger.warn(`Stream failed: ${err}`);
                                    }
                                });
                                this._parseAndSend(stream, info.command);
                                stream.exit(0);
                                ending = true;
                                stream.end();
                            }
                            catch (err) {
                                logger.error(`Exception caught: ${err}`);
                            }
                        })
                            .once('shell', (accept, reject, info) => {
                            let stream = accept();
                            stream.write("$ ");
                            let len = 0;
                            let cursor = 0;
                            let history = [];
                            let historyPointer = -1;
                            let sig = false;
                            const rightarrow = Buffer.from([27, 91, 67]);
                            const leftarrow = Buffer.from([27, 91, 68]);
                            const normal = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890';
                            let tabCount = 0;
                            let keys = [
                                { name: "uparrow", value: Buffer.from([27, 91, 65]), action: () => {
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
                                    } },
                                { name: "downarrow", value: Buffer.from([27, 91, 66]), action: () => {
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
                                    } },
                                { name: "rightarrow", value: Buffer.from([27, 91, 67]), action: (data) => {
                                        if (cursor < len) {
                                            stream.write(data);
                                            cursor++;
                                        }
                                    } },
                                { name: "leftarrow", value: Buffer.from([27, 91, 68]), action: (data) => {
                                        if (cursor > 0) {
                                            stream.write(data);
                                            cursor--;
                                        }
                                    } },
                                { name: "ctrlrightarrow", value: Buffer.from([27, 91, 49, 59, 53, 67]), action: () => {
                                        if (cursor < len) {
                                            do {
                                                cursor++;
                                                stream.write(rightarrow);
                                            } while (cursor < len && normal.includes(String.fromCharCode(line[cursor])));
                                        }
                                    } },
                                { name: "ctrlleftarrow", value: Buffer.from([27, 91, 49, 59, 53, 68]), action: () => {
                                        if (cursor > 0) {
                                            do {
                                                cursor--;
                                                stream.write(leftarrow);
                                            } while (cursor > 0 && normal.includes(String.fromCharCode(line[cursor - 1])));
                                        }
                                    } },
                                { name: "backspace", value: Buffer.from([127]), action: () => {
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
                                    } },
                                { name: "delete", value: Buffer.from([27, 91, 51, 126]), action: () => {
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
                                    } },
                                { name: "home", value: Buffer.from([27, 91, 49, 126]), action: () => {
                                        while (cursor--) {
                                            stream.write(leftarrow);
                                        }
                                        cursor++;
                                    } },
                                { name: "end", value: Buffer.from([27, 91, 52, 126]), action: () => {
                                        while (++cursor < len + 1) {
                                            stream.write(rightarrow);
                                        }
                                        cursor--;
                                    } },
                                { name: "tab", value: Buffer.from([9]), action: () => {
                                        let allCmds;
                                        if (len == 0 || !sig) {
                                            if (++tabCount > 1) {
                                                allCmds = this._commands.map((cmd) => cmd.commandName.padEnd(8));
                                                stream.write('\r\n');
                                                stream.write(`${allCmds.join('\t')}\r\n`);
                                                stream.write(`$ ${line.slice(0, len).toString()}`);
                                            }
                                        }
                                        else {
                                            let cmdWords = line.slice(0, cursor).toString().split(' ');
                                            if (cmdWords.length == 1) {
                                                allCmds = this._commands.filter((cmd) => cmd.commandName.startsWith(cmdWords[0])).map((cmd) => cmd.commandName);
                                                if (allCmds.length == 1) {
                                                    let cursorAdjust = line.slice(cursor, len).toString().length;
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
                                                let command = this._commands.find((entry) => entry.commandName == cmdWords[0].toLowerCase());
                                                if (command) {
                                                    let possibles = command.tabParameters(this._parent, ++tabCount, cmdWords);
                                                    switch (possibles.length) {
                                                        case 0:
                                                            break;
                                                        case 1:
                                                            let cursorAdjust = line.slice(cursor, len).toString().length;
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
                                                            let curr;
                                                            for (let i = 1; i < possibles.length; i++) {
                                                                curr = 0;
                                                                while (curr < resultLen && curr < possibles[i].length && possibles[0][curr] == possibles[i][curr]) {
                                                                    curr++;
                                                                }
                                                                resultLen = curr;
                                                            }
                                                            stream.write('\r\n');
                                                            stream.write(`${possibles.map((poss) => poss.padEnd(8)).join('\t')}\r\n`);
                                                            let lastLen = cmdWords[cmdWords.length - 1].length;
                                                            line = Buffer.concat([line.slice(0, len), Buffer.from(possibles[0].substr(lastLen, resultLen - lastLen)), line.slice(len)]);
                                                            len += resultLen - lastLen;
                                                            cursor += resultLen - lastLen;
                                                            stream.write(`$ ${line.slice(0, len).toString()}`);
                                                            break;
                                                    }
                                                }
                                            }
                                        }
                                    } },
                                { name: "enter", value: Buffer.from([13]), action: () => __awaiter(this, void 0, void 0, function* () {
                                        if (sig && len > 0) {
                                            let cmd = line.toString().substr(0, len);
                                            if (cmd == 'exit') {
                                                stream.write('\r\n');
                                                stream.exit(0);
                                                stream.close();
                                                return;
                                            }
                                            else {
                                                yield this._parseAndSend(stream, line.slice(0, len).toString(), true);
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
                                    }) },
                                { name: 'escape', value: Buffer.from([27]), action: () => { } },
                            ];
                            const tab = Buffer.from([9]);
                            stream.on('data', (data) => {
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
                    });
                });
            }).listen(this._port, this._host, () => {
                logger.info(`SSH server listening on port ${this._port}`);
            });
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                this._server.close(() => resolve());
            });
        });
    }
}
module.exports = TransportSSH;
//# sourceMappingURL=transportssh.js.map