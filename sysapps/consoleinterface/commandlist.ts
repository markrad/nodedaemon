import { Channel } from "node:diagnostics_channel";
import { IHaItem } from "../../haitems/haparentitem";
import { HaMain } from "../../hamain";

var log4js = require('log4js');
import { CommandBase } from './commandbase'; 

const CATEGORY = 'CommandList';
var logger = log4js.getLogger(CATEGORY);

export class CommandList extends CommandBase {
    constructor() {
        super('list', ['apps', 'items', 'types', 'names']);
    }

    get helpText() {
        return `${this.commandName} \tapps\r\n\titems <optional regex>\r\n\ttypes <optional regex>\r\n\tnames <optional regex>\tList the selected type with optional regex filter`;
    }

    tabTargets(that, tabCount, parameters) {
        let items: Map<string, IHaItem> = that.items.items;
        let possibles;
        switch (parameters[1]) {
            case 'apps':
                return [];
            case 'items':
                possibles = [ ...items ]
                    .filter((item) => item[1].entityId.startsWith(parameters[2]))
                    .map((item) => item[1].entityId)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            case 'types':
                possibles = Object.keys(that.items)
                    .filter(item => that.items[item].__proto__.constructor.name.startsWith(parameters[2]))
                    .map((item) => that.items[item].__proto__.constructor.name)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            case 'names':
                possibles = Object.keys(that.items)
                    .filter(item => that.items[item].attributes.friendly_name != undefined && that.items[item].attributes.friendly_name.startsWith(parameters[2]))
                    .map((item) => that.items[item].attributes.friendly_name)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            default:
                possibles = [];
            break;
        }
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    // TODO Can we have a more specific transport type here?
    execute(inputArray: string[], that: HaMain, sock: any): void {
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
        if (items.length == 0) {
            sock.write('No matching items found\r\n');
        }
        else {
            let maxType = 1 + items.reduce((max, item) => max = Math.max(max, item.type.length), 0);
            let maxName = 1 + items.reduce((max, item) => max = Math.max(max, item.name.length), 0);
            sock.write(`${'Type'.padEnd(maxType)}${'Name'.padEnd(maxName)}Friendly Name\r\n`);
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

// module.exports = CommandList;