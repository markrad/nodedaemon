var log4js = require('log4js');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandStop';
var logger = log4js.getLogger(CATEGORY);

class CommandStop extends CommandBase {
    constructor() {
        super('stop');
    }

    get helpText() {
        return `${this.commandName}\t\t\t\tStops the service`;
    }

    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
            logger.debug('Stop called');
            sock.write('Requested stop will occur in five seconds\r\n');
            setTimeout(async () => {
                await that._controller.stop();
                process.exit(0);
            }, 5000);
            }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}

module.exports = CommandStop;