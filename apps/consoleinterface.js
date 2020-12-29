const net = require('net');
var log4js = require('log4js');

const CATEGORY = 'ConsoleInterface';
var logger = log4js.getLogger(CATEGORY);

class ConsoleInterface {
    constructor(controller, config) {
        this.config = config.consoleInterface || {};
        this.host = config.host || '0.0.0.0';
        this.port = config.port || 2022;
        this.controller = controller;
        this.items = controller.items;
        this.server = null;
        logger.debug('Constructed');
    }

    _listItems(that, sock, data) {
        logger.debug(`listitems called with ${data.join(' ')}`);
        let re = data[1]? new RegExp(data[1]) : null;
        Object.keys(that.items)
            .filter(item => re? re.test(that.items[item].entityId) : true)
            .sort((l, r) => that.items[l].entityId < that.items[r].entityId? -1 : 1)
            .forEach((item) => {
            sock.write(`${that.items[item].entityId}:${that.items[item].__proto__.constructor.name}\n`)
        });
    }

    _listTypes(that, sock, data) {
        logger.debug(`listtypes called with ${data.join(' ')}`);
        let re = data[1]? new RegExp(data[1]) : null;
        Object.keys(that.items)
            .filter(item => re? re.test(that.items[item].__proto__.constructor.name) : true)
            .sort((l, r) => that.items[l].__proto__.constructor.name + that.items[l].entityId < that.items[r].__proto__.constructor.name + that.items[r].entityId? -1 : 1)
            .forEach((item) => {
            sock.write(`${that.items[item].__proto__.constructor.name}:${that.items[item].entityId}\n`)
        });
    }

    _inspect(that, sock, data) {
        logger.debug(`listitems called with ${data.join(' ')}`);
        let re = data[1]? new RegExp(data[1]) : null;
        Object.keys(that.items)
            .filter(item => re? re.test(that.items[item].entityId) : true)
            .sort((l, r) => that.items[l].entityId < that.items[r].entityId? -1 : 1)
            .forEach((item) => {
            sock.write(`Entity Id = ${that.items[item].entityId}\n`);
            sock.write(`Type = ${that.items[item].__proto__.constructor.name}\n`);
            sock.write(`State = ${that.items[item].state}\n`);
            sock.write('Attributes:\n');
            sock.write(`${JSON.stringify(that.items[item].attributes, null, 2)}\n`);
        });
    }

    async run() {
        let that = this;
        let name = this.controller.haConfig.location_name;
        let commands = {
            'help': [': Print this message', (_that, sock) => {
                sock.write('Available commands:\n');
                Object.keys(commands).forEach((command) => sock.write(`${command}${commands[command][0]}\n`));
            }],
            'listitems': [' [optional regex]: List items optionally filtered by a regex query', this._listItems],
            'listtypes': [' [optional regex]: List items by type optionally filtered by a regex query', this._listTypes],
            'inspect': [' [optional regex]: Inspect items optionally filtered by a regex query', this._inspect],
            'getconfig': [': Displays instance configuration', (_that, sock) => {
                sock.write('Configuration:\n');
                sock.write(JSON.stringify(that.controller.haConfig, null, 2));
                sock.write('\n');
            }],
        }
        this.server = net.createServer();
        this.server.listen(this.port, this.host);
        this.server.on('connection', (sock) => {
            sock.write(`\nConnected to ${name} - enter help for a list of commands\n\n`)
            sock.write(`${name} > `);
            logger.debug(`Socket connected ${sock.remoteAddress}`);
            sock.on('data', (data) => {
                let dataWords = data.toString().split(/\s/).filter(e => e);
                logger.debug(`Reveived from ${sock.remoteAddress}: ${dataWords.join(' ')}`);

                if (dataWords[0].toLowerCase() in commands) {
                    commands[dataWords[0]][1](that, sock, dataWords);
                }
                else {
                    sock.write(`Unknown command ${data}\n`);
                }
                sock.write(`${name} > `);
            });
            sock.on('close', () => {
                logger.debug(`Socket ${sock.remoteAddress} closed`);
            });
        }).listen(this.port, this.host);
    }

    async stop() {
        return new Promise((resolve, _reject) => {
            this.server.close(() => resolve());
        })
    }
}

module.exports = ConsoleInterface;