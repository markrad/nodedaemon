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

    async _parseAndSend(stream, cmd) {

        let words = cmd.trim().split(' ');

        let command = this._commands.find((entry) => entry.commandName == words[0].toLowerCase());

        if (!command) {
            stream.write(`Unknown command: ${words[0]}\r\n`);
        }
        else {
            await command.execute(words, this._parent, stream, this);
        }
    }

    async start() {
        this._server = net.createServer();
        this._server.on('connection', async (sock) => {
            sock.write(`\nConnected to ${this._name} - enter help for a list of commands\n\n`);
            sock.write(`${this._name} > `);
            logger.debug(`Socket connected ${sock.remoteAddress}`);
            sock.on('data', async (data) => {
                if (data.toString() == 'exit\r\n') {
                    sock.write('Closing\n');
                    setTimeout(() => sock.end(), 500);
                }
                else {
                    await this._parseAndSend(sock, data.toString());
                    sock.write(`${this._name} $ `);
                }
            });
            sock.on('close', () => {
                logger.debug(`Socket ${sock.remoteAddress} closed`);
            });
        }).listen(this._port, this._host);
        logger.info(`Telnet server listening on port ${this._port}`);
    }

    async stop() {
        return new Promise((resolve, _reject) => {
            this._server.close(() => resolve());
        });
    }
}

module.exports = TransportTelnet;
