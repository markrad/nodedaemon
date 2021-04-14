var log4js = require('log4js');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandHelp';
var logger = log4js.getLogger(CATEGORY);

class CommandHelp extends CommandBase {
    constructor() {
        super('help');
    }

    get helpText() {
        return `${this.commandName}\t\t\t\tPrints this message`;
    }

    execute(inputArray, _that, sock, parent) {
        try {
            this.validateParameters(inputArray);
            sock.write('Available commands:\r\n');
            parent._commands.forEach((item) => sock.write(`${item.helpText}\r\n`));
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}

module.exports = CommandHelp;