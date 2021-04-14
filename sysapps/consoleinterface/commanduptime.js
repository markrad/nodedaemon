var log4js = require('log4js');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandUptime';
var logger = log4js.getLogger(CATEGORY);

class CommandUptime extends CommandBase {
    constructor() {
        super('uptime');
    }

    get helpText() {
        return `${this.commandName}\t\t\t\tTime since last restart`;
    }

    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
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
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}

module.exports = CommandUptime;