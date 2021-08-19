"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandList = void 0;
const log4js_1 = require("log4js");
const commandbase_1 = require("./commandbase");
const CATEGORY = 'CommandList';
var logger = log4js_1.getLogger(CATEGORY);
class CommandList extends commandbase_1.CommandBase {
    constructor() {
        super('list', ['apps', 'items', 'types', 'names']);
    }
    get helpText() {
        return `${this.commandName} \tapps\r\n\titems <optional regex>\r\n\ttypes <optional regex>\r\n\tnames <optional regex>\tList the selected type with optional regex filter`;
    }
    tabTargets(that, tabCount, parameters) {
        let items = that.items.items;
        let possibles;
        switch (parameters[1]) {
            case 'apps':
                return [];
            case 'items':
                possibles = [...items]
                    .filter((item) => item[1].name.startsWith(parameters[2]))
                    .map((item) => item[1].name)
                    .sort((l, r) => l < r ? -1 : 1);
                break;
            case 'types':
                possibles = [...items]
                    .filter(item => item[1].type.startsWith(parameters[2]))
                    .filter((item, index, self) => {
                    return index == self.findIndex((innerItem) => innerItem[1].type == item[1].type);
                })
                    .map((item) => item[1].type)
                    .sort((l, r) => l < r ? -1 : 1);
                break;
            case 'names':
                possibles = [...items]
                    .filter(item => { var _a; return (_a = item[1].attributes) === null || _a === void 0 ? void 0 : _a.friendly_name.startsWith(parameters[2]); })
                    .map((item) => item[1].attributes.friendly_name)
                    .sort((l, r) => l < r ? -1 : 1);
                break;
            default:
                possibles = [];
                break;
        }
        return (possibles.length == 1 || tabCount > 1) ? possibles : [];
    }
    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
            let re;
            let items;
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
                    items = inputArray[2]
                        ? that.items.getItemByName(inputArray[2], true)
                        : that.items.getItemByName();
                    this._printItems(sock, items);
                    break;
                case 'types':
                    logger.debug(`listtypes called with ${inputArray.join(' ')}`);
                    if (inputArray.length > 3) {
                        throw new Error(`Too many parameters passed`);
                    }
                    items = inputArray[2]
                        ? that.items.getItemByType(inputArray[2], true)
                        : that.items.getItemByType();
                    this._printItems(sock, items);
                    break;
                case 'names':
                    logger.debug(`listnames called with ${inputArray.join(' ')}`);
                    if (inputArray.length > 3) {
                        throw new Error(`Too many parameters passed`);
                    }
                    items = inputArray[2]
                        ? that.items.getItemByFriendly(inputArray[2], true)
                        : that.items.getItemByFriendly();
                    this._printItems(sock, items);
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
    _printItems(sock, items) {
        const TYPE = 'Type';
        const NAME = 'Name';
        const FRIENDLY = 'Friendly Name';
        if (items.length == 0) {
            sock.write('No matching items found\r\n');
        }
        else {
            let maxType = 1 + Math.max(items.reduce((max, item) => max = Math.max(max, item.type.length), 0), TYPE.length);
            let maxName = 1 + Math.max(items.reduce((max, item) => max = Math.max(max, item.name.length), 0), NAME.length);
            sock.write(`${TYPE.padEnd(maxType)}${NAME.padEnd(maxName)}${FRIENDLY}\r\n`);
            items.forEach((item) => sock.write(`${item.type.padEnd(maxType)}${item.name.padEnd(maxName)}${item.attributes.friendly_name}\r\n`));
        }
    }
    _listapps(that, sock) {
        logger.debug('listapps called');
        that.controller.apps.forEach((app) => {
            sock.write(`${app.name} ${app.path} ${app.status}\r\n`);
        });
    }
}
exports.CommandList = CommandList;
// module.exports = CommandList;
//# sourceMappingURL=commandlist.js.map