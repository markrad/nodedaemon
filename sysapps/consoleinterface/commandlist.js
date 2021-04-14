var log4js = require('log4js');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandList';
var logger = log4js.getLogger(CATEGORY);

class CommandList extends CommandBase {
    constructor() {
        super('list', ['apps', 'items', 'types', 'names']);
    }

    get helpText() {
        return `${this.commandName} \tapps\r\n\titems <optional regex>\r\n\ttypes <optional regex>\r\n\tnames <optional regex>\tList the selected type with optional regex filter`;
    }

    tabTargets(that, tabCount, parameters) {
        let possibles;
        switch (parameters[1]) {
            case 'apps':
                return [];
            case 'items':
                possibles = Object.keys(that._items)
                    .filter((item) => that._items[item].entityId.startsWith(parameters[2]))
                    .map((item) => that._items[item].entityId)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            case 'types':
                possibles = Object.keys(that._items)
                    .filter(item => that._items[item].__proto__.constructor.name.startsWith(parameters[2]))
                    .map((item) => that._items[item].__proto__.constructor.name)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            case 'names':
                possibles = Object.keys(that._items)
                    .filter(item => that._items[item].attributes.friendly_name != undefined && that._items[item].attributes.friendly_name.startsWith(parameters[2]))
                    .map((item) => that._items[item].attributes.friendly_name)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            default:
                possibles = [];
            break;
        }
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
        // let possibles = that._controller.apps.filter((app) => app.name.startsWith(parameters[2])).map((app) => app.name);
        
        // if (possibles.length == 0 || (tabCount < 2 && possibles.length > 1)) {
        //     return [];
        // }
        // else {
        //     return possibles;
        // }
    }

    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
            let re;
            switch (inputArray[1]) {
                case 'apps':
                    if (inputArray.length != 2) {
                        throw new Error(`Too many parameters passed`);
                    }
                    else {
                        this._listapps(that, sock);
                    }
                break;
                case 'items':
                    logger.debug(`listitems called with ${inputArray.join(' ')}`);
                    if (inputArray.length > 3) {
                        throw new Error(`Too many parameters passed`);
                    }
                    re = inputArray[2]? new RegExp(inputArray[2]) : null;
                    Object.keys(that._items)
                        .filter(item => re? re.test(that._items[item].entityId) : true)
                        .sort((l, r) => that._items[l].entityId < that._items[r].entityId? -1 : 1)
                        .forEach((item) => {
                            sock.write(`${that._items[item].entityId}:${that._items[item].__proto__.constructor.name}\r\n`)
                        });
                break;
                case 'types':
                    logger.debug(`listtypes called with ${inputArray.join(' ')}`);
                    if (inputArray.length > 3) {
                        throw new Error(`Too many parameters passed`);
                    }
                    re = inputArray[2]? new RegExp(inputArray[2]) : null;
                    Object.keys(that._items)
                        .filter(item => re? re.test(that._items[item].__proto__.constructor.name) : true)
                        .sort((l, r) => that._items[l].__proto__.constructor.name + that._items[l].entityId < that._items[r].__proto__.constructor.name + that._items[r].entityId? -1 : 1)
                        .forEach((item) => {
                            sock.write(`${that._items[item].__proto__.constructor.name}:${that._items[item].entityId}\r\n`)
                        });
                break;
                case 'names':
                    logger.debug(`listnames called with ${inputArray.join(' ')}`);
                    if (inputArray.length > 3) {
                        throw new Error(`Too many parameters passed`);
                    }
                    re = inputArray[2]? new RegExp(inputArray[2]) : null;
                    Object.keys(that._items)
                        .filter(item => re? re.test(that._items[item].attributes.friendly_name) : true)
                        .sort((l, r) => that._items[l].attributes.friendly_name < that._items[r].attributes.friendly_name)
                        .forEach((item) => {
                            sock.write(`${that._items[item].__proto__.constructor.name}:${that._items[item].entityId}:${that._items[item].attributes.friendly_name}\r\n`)
                        })
                break;
            }
        }
        catch (err) {
            sock.write(`${err}\r\n`);
            sock.write('Usage:\r\n');
            sock.write(this.helpText);
            sock.write('\r\n');
        }
    }

    _listapps(that, sock) {
        logger.debug('listapps called');
        that._controller.apps.forEach((app) => {
            sock.write(`${app.name} ${app.path} ${app.status}\r\n`);
        });
    }
}

module.exports = CommandList;