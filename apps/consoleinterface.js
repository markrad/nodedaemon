const net = require('net');
var log4js = require('log4js');

const CATEGORY = 'ConsoleInterface';
var logger = log4js.getLogger(CATEGORY);

class ConsoleInterface {
    constructor(controller, config) {
        let _config = config.consoleInterface || {};
        this._host = _config.host || '0.0.0.0';
        this._port = _config.port || 2022;
        this._controller = controller;
        this._items = controller.items;
        this._server = null;
        logger.debug('Construction complete');
    }

    async _list(that, sock, dataWords) {

        if (dataWords.length > 0) {
            switch (dataWords[0].toLowerCase()) {
                case 'apps':
                    that._listApps(that, sock, dataWords.splice(1));
                    break;
                case 'items':
                    that._listItems(that, sock, dataWords.splice(1));
                    break;
                case 'types':
                    that._listTypes(that, sock, dataWords.splice(1));
                    break;
                case 'names':
                    that._listNames(that, sock, dataWords.splice(1));
                    break;
                case 'help':
                    sock.write('list apps | items <regex> | types <regex>\n');
                    break;
                default:
                    sock.write(`Unknown argument ${dataWords[0]}: must be apps | items <regex> | types <regex> | names <regex>\n`);
                    logger.debug(`Unknown list option ${dataWords[0]}`);
                    break;
            }
        }
        else {
            sock.write('list missing argument - requires apps | items <regex> | types <regex> | names <regex>\n');
        }
    }

    _listItems(that, sock, dataWords) {
        logger.debug(`listitems called with ${dataWords.join(' ')}`);
        let re = dataWords[0]? new RegExp(dataWords[0]) : null;
        Object.keys(that._items)
            .filter(item => re? re.test(that._items[item].entityId) : true)
            .sort((l, r) => that._items[l].entityId < that._items[r].entityId? -1 : 1)
            .forEach((item) => {
                sock.write(`${that._items[item].entityId}:${that._items[item].__proto__.constructor.name}\n`)
            });
    }

    _listTypes(that, sock, dataWords) {
        logger.debug(`listtypes called with ${dataWords.join(' ')}`);
        let re = dataWords[0]? new RegExp(dataWords[0]) : null;
        Object.keys(that._items)
            .filter(item => re? re.test(that._items[item].__proto__.constructor.name) : true)
            .sort((l, r) => that._items[l].__proto__.constructor.name + that._items[l].entityId < that._items[r].__proto__.constructor.name + that._items[r].entityId? -1 : 1)
            .forEach((item) => {
                sock.write(`${that._items[item].__proto__.constructor.name}:${that._items[item].entityId}\n`)
            });
    }

    _listNames(that, sock, dataWords) {
        logger.debug(`listnames called with ${dataWords.join(' ')}`);
        let re = dataWords[0]? new RegExp(dataWords[0]) : null;
        Object.keys(that._items)
            .filter(item => re? re.test(that._items[item].attributes.friendly_name) : true)
            .sort((l, r) => that._items[l].attributes.friendly_name < that._items[r].attributes.friendly_name)
            .forEach((item) => {
                sock.write(`${that._items[item].__proto__.constructor.name}:${that._items[item].entityId}:${that._items[item].attributes.friendly_name}\n`)
            })
    }

    _listApps(that, sock, _dataWords) {
        logger.debug('listapps called');
        that._controller.apps.forEach((app) => {
            sock.write(`${app.name} ${app.path} ${app.status}\n`);
        });
    }

    async _app(that, sock, dataWords) {
        if (dataWords.length > 0) {
            switch(dataWords[0].toLowerCase()) {
                case 'start':
                    that._appStart(that, sock, dataWords.splice(1));
                    break;
                case 'stop':
                    that._appStop(that, sock, dataWords.splice(1));
                    break;
                case 'list':
                    that._listApps(that, sock, dataWords.splice(1));
                    break;
                default:
                    sock.write(`Unknown argument ${dataWords[0]}: must be start appname | stop appname | list\n`);
                    break;
            }
        }
        else {
            sock.write('app missing arument - requires start appname | stop appname | list\n');
        }
    }

    async _appStop(that, sock, dataWords) {
        return new Promise(async (resolve, _reject) => {
            let appName = dataWords[0];
            let aps = that._controller.apps.filter((item) =>item.name == appName);
            try {
                if (aps[0].status != 'running') {
                    sock.write(`Cannot stop app ${aps[0].name} - status is ${aps[0].status}\n`);
                }
                else {
                    await aps[0].instance.stop();
                    aps[0].status = 'stopped';
                    sock.write(`App ${aps[0].name} stopped\n`)
                }
            }
            catch (err) {
                logger.debug(`Failed to stop app ${appName}: ${err.message}`);
                
                if (aps.length > 0) {
                    aps[0].status = 'failed';
                    sock.write(`Failed to stop app ${appName}: ${err.message}\n`);
                }
                else {
                    sock.write(`Failed to stop app ${appName}: App was not found\n`);
                }
            }

            resolve();
        });
    }

    async _appStart(that, sock, dataWords) {
        return new Promise(async (resolve, _reject) => {
            let appName = dataWords[0];
            let aps = that._controller.apps.filter((item) =>item.name == appName);
            try {
                if (aps[0].status == 'running') {
                    sock.write(`Cannot start app ${aps[0].name} - already running\n`);
                }
                else {
                    await aps[0].instance.run();
                    aps[0].status = 'running';
                    sock.write(`App ${aps[0].name} started\n`)
                }
            }
            catch (err) {
                logger.debug(`Failed to start app ${appName}: ${err.message}`);
                
                if (aps.length > 0) {
                    aps[0].status = 'failed';
                    sock.write(`Failed to start app ${appName}: ${err.message}\n`);
                }
                else {
                    sock.write(`Failed to start app ${appName}: App was not found\n`);
                }
            }

            resolve();
        });
    }

    _inspect(that, sock, dataWords) {
        logger.debug(`listitems called with ${dataWords.join(' ')}`);
        let re = dataWords[0]? new RegExp(dataWords[0]) : null;
        Object.keys(that._items)
            .filter(item => re? re.test(that._items[item].entityId) : true)
            .sort((l, r) => that._items[l].entityId < that._items[r].entityId? -1 : 1)
            .forEach((item) => {
            sock.write(`Entity Id = ${that._items[item].entityId}\n`);
            sock.write(`Type = ${that._items[item].__proto__.constructor.name}\n`);
            sock.write(`State = ${that._items[item].state}\n`);
            sock.write('Attributes:\n');
            sock.write(`${JSON.stringify(that._items[item].attributes, null, 2)}\n`);
        });
    }

    _uptime(that, sock, _dataWords) {
        var millis = (new Date() - that._controller.startTime);
        var seconds = (Math.floor((millis / 1000) % 60)).toString().padStart(2, '0') + ' second';
        var minutes = (Math.floor((millis / (1000 * 60)) % 60)).toString().padStart(2, '0') + ' minute';
        var hours = (Math.floor((millis / (1000 * 60 * 60)) % 24)).toString().padStart(2, '0') + ' hour';
        var days = (Math.floor(millis / (1000 * 60 * 60 * 24) % 24)).toString() + ' day';
        if (!seconds.startsWith('01')) seconds += 's';
        if (!minutes.startsWith('01')) minutes += 's';
        if (!hours.startsWith('01')) hours += 's';
        if (!days.startsWith('1')) days += 's';
        sock.write(`${days} ${hours} ${minutes} ${seconds}\n`);
    }

     _stop(that, sock, _dataWords) {
        logger.debug('Stop called');
        sock.write('Requested stop will occur in five seconds\n');
        setTimeout(async () => {
            await that._controller.stop();
            process.exit(0);
        }, 5000);
    }

    async run() {
        let that = this;
        let name = this._controller.haConfig.location_name;
        let commands = {
            'help': ['\t\t\t\tPrint this message', (_that, sock) => {
                sock.write('Available commands:\n');
                Object.keys(commands).forEach((command) => sock.write(`${command}${commands[command][0]}\n`));
            }],
            'list': [' \tapps\n\titems <optional regex>\n\ttypes <optional regex>\n\tnames <optional regex>\tList the selected type with optional regex filter', this._list],
            'inspect': [' <optional regex>\tInspect items optionally filtered by a regex query', this._inspect],
            'getconfig': ['\t\t\tDisplays instance configuration', (_that, sock) => {
                sock.write('Configuration:\n');
                sock.write(JSON.stringify(that._controller.haConfig, null, 2));
                sock.write('\n');
            }],
            'app': ['\tstart appname\n\tstop appname\n\tlist\t\t\tStart or stop the specified app or list all apps (same as list apps)', this._app],
            'uptime': ['\t\t\t\tTime since last restart', this._uptime],
            'stop': ['\t\t\t\tStops the service', this._stop],
            'exit': ['\t\t\t\tExit', (_that, sock) => {
                sock.write('Closing\n');
                setTimeout(() => sock.end(), 500);
            }],
        }
        this._server = net.createServer();
        // this._server.listen(this._port, this._host);
        this._server.on('connection', async (sock) => {
            sock.write(`\nConnected to ${name} - enter help for a list of commands\n\n`)
            sock.write(`${name} > `);
            logger.debug(`Socket connected ${sock.remoteAddress}`);
            sock.on('data', async (data) => {
                let dataWords = data.toString().split(/\s/).filter(e => e);
                logger.debug(`Reveived from ${sock.remoteAddress}: ${dataWords}`);

                if (dataWords.length > 0 && dataWords[0].charCodeAt != 0) {
                    if (dataWords[0].toLowerCase() in commands) {
                        await commands[dataWords[0].toLowerCase()][1](that, sock, dataWords.splice(1));
                    }
                    else {
                        sock.write(`Unknown command ${data}\n`);
                    }
                }
                sock.write(`${name} > `);
            });
            sock.on('close', () => {
                logger.debug(`Socket ${sock.remoteAddress} closed`);
            });
        }).listen(this._port, this._host);
    }

    async stop() {
        return new Promise((resolve, _reject) => {
            this._server.close(() => resolve());
        })
    }
}

module.exports = ConsoleInterface;