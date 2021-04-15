var log4js = require('log4js');
const { reject } = require('underscore');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandApp';
var logger = log4js.getLogger(CATEGORY);

class CommandApp extends CommandBase {
    constructor() {
        super('app', ['start', 'stop', 'list']);
    }

    get helpText() {
        return `${this.commandName}\tstart appname\r\n\tstop appname\r\n\tlist\t\t\tStart or stop the specified app or list all apps (same as list apps)`;
    }

    async _appStart(inputArray, that, sock) {
        return new Promise(async (resolve, reject) => {
            logger.debug('app start called');
            let appName = inputArray[2];
            let aps = that.controller.apps.filter((item) =>item.name == appName);
            try {
                if (aps.length != 1) {
                    return reject(new Error(`App ${inputArray[2]} does not exist`));
                }
                if (aps[0].status == 'running') {
                    return reject(new Error(`Cannot start app ${aps[0].name} - already running`));
                }
                else {
                    await aps[0].instance.run();
                    aps[0].status = 'running';
                    sock.write(`App ${aps[0].name} started\r\n`);
                }
            }
            catch (err) {
                logger.debug(`Failed to start app ${appName}: ${err.message}`);
                aps[0].status = 'failed';
                return reject(new Error(`Failed to start app ${appName}: ${err.message}`));
            }

            return resolve();
        });
    }

    async _appStop(inputArray, that, sock) {
        return new Promise(async (resolve, reject) => {
            logger.debug('app stop called');
            let appName = inputArray[2];
            let aps = that.controller.apps.filter((item) =>item.name == appName);
            try {
                if (aps.length != 1) {
                    return reject(new Error(`App ${inputArray[2]} does not exist`));
                }
                if (aps[0].status != 'running') {
                    return reject(new Error(`Cannot stop app ${aps[0].name} - status is ${aps[0].status}\r\n`));
                }
                else {
                    await aps[0].instance.stop();
                    aps[0].status = 'stopped';
                    sock.write(`App ${aps[0].name} stopped\r\n`)
                }
            }
            catch (err) {
                logger.debug(`Failed to stop app ${appName}: ${err.message}`);
                aps[0].status = 'failed';
                return reject(new Error(`Failed to stop app ${appName}: ${err.message}`));
            }

            return resolve();
        });
    }

    _listapps(_inputArray, that, sock) {
        logger.debug('app list called');
        that.controller.apps.forEach((app) => {
            sock.write(`${app.name} ${app.path} ${app.status}\r\n`);
        });
    }

    tabTargets(that, tabCount, parameters) {
        let possibles = that.controller.apps.filter((app) => app.name.startsWith(parameters[2])).map((app) => app.name);
        
        if (possibles.length == 0 || (tabCount < 2 && possibles.length > 1)) {
            return [];
        }
        else {
            return possibles;
        }
    }

    async execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
            switch (inputArray[1]) {
                case "start":
                    if (inputArray.length != 3) {
                        throw new Error('Missing or invalid arguments');
                    }
                    await this._appStart(inputArray, that, sock);
                break;
                case "stop":
                    if (inputArray.length != 3) {
                        throw new Error('Missing or invalid arguments');
                    }
                    await this._appStop(inputArray, that, sock);
                break;
                case "list":
                    if (inputArray.length != 2) {
                        throw new Error('Excessive arguments');
                    }
                    this._listapps(inputArray, that, sock);
                break;
            }
        }
        catch (err) {
            logger.error(`${err}`);
            sock.write(`${err}\r\n`);
            sock.write('Usage:\r\n');
            sock.write(this.helpText);
            sock.write('\r\n');
        }
    }
}

module.exports = CommandApp;