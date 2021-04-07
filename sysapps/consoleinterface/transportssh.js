const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
var ssh2 = require('ssh2');
var utils = ssh2.utils;
var log4js = require('log4js');
const { intersection } = require('underscore');

const CATEGORY = 'TransportTSSH';
var logger = log4js.getLogger(CATEGORY);

class TransportSSH {
    constructor(name, parent, commands, config) {
        this._name = name;
        this._parent = parent;
        this._host = config?.ssh.host || '0.0.0.0';
        this._port = config?.ssh.port || 8822;
        this._commands = commands;
        this._server = null;
        this._users = [];

        if (!config?.ssh.certFile || !config?.ssh.keyFile) {
            throw new err('Required certificate or key file locations are missing');
        }

        if (!config?.ssh.users || typeof(config.ssh.users) != 'object' || Array.isArray(config.ssh.users) == false) {
            throw new err('No userids were provided');
        }

        config.ssh.users.forEach(user => {
            if (!user.userid || !user.password) {
                throw new err('Incorrect format for userids');
            }
            this._users.push({ userid: Buffer.from(user.userid), password: Buffer.from(user.password) });
        });

        let cert = config.ssh.certFile;
        let key = config.ssh.keyFile;

        if (!path.isAbsolute(cert)) {
            cert = path.join(__dirname, cert);
        }

        if (!path.isAbsolute(key)) {
            key = path.join(__dirname, key);
        }

        this._allowdPubKey = utils.parseKey(fs.readFileSync(cert));
        this._hostKey = fs.readFileSync(key);
    }

    async _parseAndSend(stream, cmd, interactive = false) {

        if (interactive) {
            stream.write('\r\n');
        }
        let words = cmd.split(' ');

        if (words[0].toLowerCase() in this._commands) {
            await this._commands[words[0].toLowerCase()][1](this._parent, stream, words.splice(1));
        }
        else {
            stream.write(`Unknown command: ${words[0]}\r\n`);
        }
    }

    async start() {
        new ssh2.Server({ hostKeys: [this._hostKey] }, (client) => {
            logger.info('New client connected');

            client
            .on('authentication', (ctx) => {
                var user = Buffer.from(ctx.username);
                let found = this._users.find((entry) => {
                    return entry.userid.length == user.length && crypto.timingSafeEqual(user, entry.userid);
                });
                if (!found) {
                    return ctx.reject();
                }

                switch (ctx.method) {
                    case 'password':
                        let password = Buffer.from(ctx.password);
                        if (password.length != found.password.length || !crypto.timingSafeEqual(password, found.password)) {
                            return ctx.reject();
                        }
                    break;
                    case 'publickey':
                        let allowedPubKey = this._allowdPubKey.getPublicSSH();
                        if (ctx.key.algo != allowedPubKey.type ||
                            ctx.key.data.length !== allowedPubKey.length ||
                            !crypto.timingSafeEqual(ctx.key.data, allowedPubKey) ||
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

                logger.info(`Client authenticated: ${ctx.user}`);
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
                                    logger.warn(`Stream failed: ${err}`)
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
                            { name: "ctrlrightarrow", value: Buffer.from([27, 91, 49, 59, 53, 67]), action: (data) => { 
                                if (cursor < len) {
                                    do {
                                        cursor++;
                                        stream.write(rightarrow);
                                    } while (cursor < len && normal.includes(String.fromCharCode(line[cursor])))
                                }
                            } },
                            { name: "ctrlleftarrow", value: Buffer.from([27, 91, 49, 59, 53, 68]), action: (data) => { 
                                if (cursor > 0) {
                                    do {
                                        cursor--;
                                        stream.write(leftarrow);
                                    } while (cursor > 0 && normal.includes(String.fromCharCode(line[cursor - 1])))
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
                            { name: "delete", value: Buffer.from([27, 91, 51, 126]), action: (data) => {
                                if (cursor < len) {
                                    stream.write(' \b');
                                    if (cursor < len - 1) {
                                        stream.write(line.slice(cursor + 1, len));
                                        stream.write(' ');
                                        for(let i = len; i > cursor; i--) {
                                            stream.write(leftarrow);
                                        }
                                        line.copy(line, cursor, cursor + 1, len);
                                    }
                                    len--;
                                }
                            } },
                            { name: "home", value: Buffer.from([27, 91, 49, 126]), action: (data) => {
                                while (cursor--) {
                                    stream.write(leftarrow);
                                }
                                cursor++;
                            } },
                            { name: "end", value: Buffer.from([27, 91, 52, 126]), action: (data) => {
                                while (++cursor < len + 1) {
                                    stream.write(rightarrow);
                                }
                                cursor--;
                            } },
                            { name: "enter", value: Buffer.from([13]), action: () => { 
                                if (sig && len > 0) {
                                    let cmd = line.toString().substr(0, len);
                                    if (cmd == 'exit') {
                                        stream.write('\r\n');
                                        stream.exit(0);
                                        stream.close();
                                        return;
                                    }
                                    else {
                                        this._parseAndSend(stream, line.slice(0, len).toString(), true);
                                    }
                                    if (history.length == 0 || cmd != history[0]) {
                                        history.unshift(cmd);
                                    }
                                }
                                if (!sig) {
                                    stream.write('\r\n');
                                }
                                stream.write('$ ');
                                // stream.write('\n\r$ ');
                                len = 0;
                                cursor = 0;
                                sig = false;
                                historyPointer = -1;
                            } },
                            { name: 'escape', value: Buffer.from([27]), action: () => {} },
                        ];
                        const tab = Buffer.from([9]);
                        stream.on('data', (data) => {
                            // console.log(`->cursor=${cursor};len=${len}`);
                            let handled = keys.find(key => Buffer.compare(key.value, data) == 0);
                            if (handled) {
                                // console.log(handled.name);
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
    }

    async stop() {
        return new Promise((resolve, _reject) => {
            this._server.close(() => resolve());
        });
    }
}

module.exports = TransportSSH;
