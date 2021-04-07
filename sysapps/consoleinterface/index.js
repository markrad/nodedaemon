var log4js = require('log4js');

const CATEGORY = 'ConsoleInterface';
var logger = log4js.getLogger(CATEGORY);

class ConsoleInterface {
    constructor(controller, config) {
        this._config = config.consoleInterface || {};
        this._controller = controller;
        this._items = controller.items;
        this._transports = [];
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
                    sock.write('list apps | items <regex> | types <regex>\r\n');
                    break;
                default:
                    sock.write(`Unknown argument ${dataWords[0]}: must be apps | items <regex> | types <regex> | names <regex>\r\n`);
                    logger.debug(`Unknown list option ${dataWords[0]}`);
                    break;
            }
        }
        else {
            sock.write('list missing argument - requires apps | items <regex> | types <regex> | names <regex>\r\n');
        }
    }

    _listItems(that, sock, dataWords) {
        logger.debug(`listitems called with ${dataWords.join(' ')}`);
        let re = dataWords[0]? new RegExp(dataWords[0]) : null;
        Object.keys(that._items)
            .filter(item => re? re.test(that._items[item].entityId) : true)
            .sort((l, r) => that._items[l].entityId < that._items[r].entityId? -1 : 1)
            .forEach((item) => {
                sock.write(`${that._items[item].entityId}:${that._items[item].__proto__.constructor.name}\r\n`)
            });
    }

    _listTypes(that, sock, dataWords) {
        logger.debug(`listtypes called with ${dataWords.join(' ')}`);
        let re = dataWords[0]? new RegExp(dataWords[0]) : null;
        Object.keys(that._items)
            .filter(item => re? re.test(that._items[item].__proto__.constructor.name) : true)
            .sort((l, r) => that._items[l].__proto__.constructor.name + that._items[l].entityId < that._items[r].__proto__.constructor.name + that._items[r].entityId? -1 : 1)
            .forEach((item) => {
                sock.write(`${that._items[item].__proto__.constructor.name}:${that._items[item].entityId}\r\n`)
            });
    }

    _listNames(that, sock, dataWords) {
        logger.debug(`listnames called with ${dataWords.join(' ')}`);
        let re = dataWords[0]? new RegExp(dataWords[0]) : null;
        Object.keys(that._items)
            .filter(item => re? re.test(that._items[item].attributes.friendly_name) : true)
            .sort((l, r) => that._items[l].attributes.friendly_name < that._items[r].attributes.friendly_name)
            .forEach((item) => {
                sock.write(`${that._items[item].__proto__.constructor.name}:${that._items[item].entityId}:${that._items[item].attributes.friendly_name}\r\n`)
            })
    }

    _listApps(that, sock, _dataWords) {
        logger.debug('listapps called');
        that._controller.apps.forEach((app) => {
            sock.write(`${app.name} ${app.path} ${app.status}\r\n`);
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
                    sock.write(`Unknown argument ${dataWords[0]}: must be start appname | stop appname | list\r\n`);
                    break;
            }
        }
        else {
            sock.write('app missing arument - requires start appname | stop appname | list\r\n');
        }
    }

    async _appStop(that, sock, dataWords) {
        return new Promise(async (resolve, _reject) => {
            let appName = dataWords[0];
            let aps = that._controller.apps.filter((item) =>item.name == appName);
            try {
                if (aps[0].status != 'running') {
                    sock.write(`Cannot stop app ${aps[0].name} - status is ${aps[0].status}\r\n`);
                }
                else {
                    await aps[0].instance.stop();
                    aps[0].status = 'stopped';
                    sock.write(`App ${aps[0].name} stopped\r\n`)
                }
            }
            catch (err) {
                logger.debug(`Failed to stop app ${appName}: ${err.message}`);
                
                if (aps.length > 0) {
                    aps[0].status = 'failed';
                    sock.write(`Failed to stop app ${appName}: ${err.message}\r\n`);
                }
                else {
                    sock.write(`Failed to stop app ${appName}: App was not found\r\n`);
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
                    sock.write(`Cannot start app ${aps[0].name} - already running\r\n`);
                }
                else {
                    await aps[0].instance.run();
                    aps[0].status = 'running';
                    sock.write(`App ${aps[0].name} started\r\n`)
                }
            }
            catch (err) {
                logger.debug(`Failed to start app ${appName}: ${err.message}`);
                
                if (aps.length > 0) {
                    aps[0].status = 'failed';
                    sock.write(`Failed to start app ${appName}: ${err.message}\r\n`);
                }
                else {
                    sock.write(`Failed to start app ${appName}: App was not found\r\n`);
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
            sock.write(`Entity Id = ${that._items[item].entityId}\r\n`);
            sock.write(`Type = ${that._items[item].__proto__.constructor.name}\r\n`);
            sock.write(`State = ${that._items[item].state}\r\n`);
            sock.write('Attributes:\r\n');
            sock.write(`${JSON.stringify(that._items[item].attributes, null, 2).replace(/\n/g, '\r\n')}\r\n`);
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
        sock.write(`${days} ${hours} ${minutes} ${seconds}\r\n`);
    }

     _stop(that, sock, _dataWords) {
        logger.debug('Stop called');
        sock.write('Requested stop will occur in five seconds\r\n');
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
                sock.write('Available commands:\r\n');
                Object.keys(commands).forEach((command) => sock.write(`${command}${commands[command][0]}\r\n`));
            }],
            'list': [' \tapps\r\n\titems <optional regex>\r\n\ttypes <optional regex>\r\n\tnames <optional regex>\tList the selected type with optional regex filter', this._list],
            'inspect': [' <optional regex>\tInspect items optionally filtered by a regex query', this._inspect],
            'getconfig': ['\t\t\tDisplays instance configuration', (_that, sock) => {
                sock.write('Configuration:\r\n');
                sock.write(JSON.stringify(that._controller.haConfig, null, 2).replace(/\n/g, '\r\n'));
                sock.write('\r\n');
            }],
            'app': ['\tstart appname\r\n\tstop appname\r\n\tlist\t\t\tStart or stop the specified app or list all apps (same as list apps)', this._app],
            'uptime': ['\t\t\t\tTime since last restart', this._uptime],
            'stop': ['\t\t\t\tStops the service', this._stop],
            'exit': ['\t\t\t\tExit', (_that, sock) => {
                sock.write('Closing\n');
                setTimeout(() => sock.end(), 500);
            }],
        }

        if (this._config?.transports) {
            try {
                this._config.transports.forEach(transport => {
                    try {
                        this._transports.push(new (require(transport))(name, this, commands, this._config));
                    }
                    catch (err) {
                        logger.error(`Failed to create transport ${transport}: ${err}`);
                    }
                });
            }
            catch (err) {
                logger.error(`Failed to interate transports ${err}`);
            }
        }

        this._transports.forEach(async (transport) => await transport.start());
    }

    async stop() {
        return new Promise((resolve, reject) => {
            let rets = [];
            this._transports.forEach(async (transport) => rets.push(transport.stop()));
            Promise.all(rets)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    }
}

module.exports = ConsoleInterface;