var log4js = require('log4js');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandInspect';
var logger = log4js.getLogger(CATEGORY);

class CommandInspect extends CommandBase {
    constructor() {
        super('inspect');
    }

    get helpText() {
        return `${this.commandName} <optional regex>\tInspect items optionally filtered by a regex query`;
    }

    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray.slice(0, inputArray.length - 1));
            if (inputArray.length != 2) {
                throw new Error('Missing or invalid inspection target');
            }
            logger.debug(`inspect called with ${inputArray.join(' ')}`);
            let re = inputArray[1]? new RegExp(inputArray[1]) : null;
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
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}

module.exports = CommandInspect;