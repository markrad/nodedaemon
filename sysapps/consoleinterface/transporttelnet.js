const net = require('net');
var log4js = require('log4js');

const CATEGORY = 'TransportTelnet';
var logger = log4js.getLogger(CATEGORY);

class TransportTelnet {
    constructor(name, parent, commands, config) {
        this._name = name;
        this._parent = parent;
        this._host = config?.telnet?.host || '0.0.0.0';
        this._port = config?.telnet?.port || 8821;
        this._commands = commands;
        this._server = null;
    }

    async start() {
        this._server = net.createServer();
        this._server.on('connection', async (sock) => {
            sock.write(`\nConnected to ${this._name} - enter help for a list of commands\n\n`);
            sock.write(`${this._name} > `);
            logger.debug(`Socket connected ${sock.remoteAddress}`);
            sock.on('data', async (data) => {
                let dataWords = data.toString().split(/\s/).filter(e => e);
                logger.debug(`Reveived from ${sock.remoteAddress}: ${dataWords}`);

                if (dataWords.length > 0 && dataWords[0].charCodeAt != 0) {
                    if (dataWords[0].toLowerCase() in this._commands) {
                        await this._commands[dataWords[0].toLowerCase()][1](this._parent, sock, dataWords.splice(1));
                    }
                    else {
                        sock.write(`Unknown command ${data}\n`);
                    }
                }
                sock.write(`${this._name} $ `);
            });
            sock.on('close', () => {
                logger.debug(`Socket ${sock.remoteAddress} closed`);
            });
        }).listen(this._port, this._host);
        logger.debug(`Telnet transport started on port ${this._port}`);
    }

    async stop() {
        return new Promise((resolve, _reject) => {
            this._server.close(() => resolve());
        });
    }
}

module.exports = TransportTelnet;
