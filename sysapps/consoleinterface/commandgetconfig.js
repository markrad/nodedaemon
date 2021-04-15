var log4js = require('log4js');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandGetConfig';
var logger = log4js.getLogger(CATEGORY);

class CommandGetConfig extends CommandBase {
    constructor() {
        super('getconfig');
    }

    get helpText() {
        return `${this.commandName}\tstart appname\r\n\tstop appname\r\n\tlist\t\t\tStart or stop the specified app or list all apps (same as list apps)`;
    }

    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
            sock.write('Configuration:\r\n');
            sock.write(JSON.stringify(that.controller.haConfig, null, 2).replace(/\n/g, '\r\n'));
            sock.write('\r\n');
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}

module.exports = CommandGetConfig;