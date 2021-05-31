"use strict";

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

    tabParameters(that, tabCount, parameters) {
        let possibles = Object.keys(that._items)
            .filter((item) => that._items[item].entityId.startsWith(parameters[1]))
            .map((item) => that._items[item].entityId)
            .sort((l, r) => l < r? -1 : 1);
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray.slice(0, inputArray.length - 1));
            if (inputArray.length != 2) {
                throw new Error('Missing or invalid inspection target');
            }
            logger.debug(`inspect called with ${inputArray.join(' ')}`);
            let items = inputArray[1]
                ? that.items.getItemByName(inputArray[1], true) 
                : that.items.getItemByName();
            items.forEach((item) => {
                sock.write(`Entity Id = ${item.entityId}\r\n`);
                sock.write(`Type = ${item.type}\r\n`);
                sock.write(`State = ${item.state}\r\n`);
                sock.write('Attributes:\r\n');
                sock.write(`${JSON.stringify(item.attributes, null, 2).replace(/\n/g, '\r\n')}\r\n`);
            });
        }
        catch (err) {
            sock.write(`${err}\r\n`);
            sock.write('Usage:\r\n');
            sock.write(this.helpText);
            sock.write('\r\n');
        }
    }
}

module.exports = CommandInspect;