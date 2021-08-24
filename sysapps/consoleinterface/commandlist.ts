import { getLogger, Logger } from "log4js";
import { CommandBase } from './commandbase'; 
import { ConsoleInterface, IChannel } from './';
import { IHaItem } from "../../haitems/haparentitem";

const CATEGORY: string = 'CommandList';
var logger: Logger = getLogger(CATEGORY);

export class CommandList extends CommandBase {
    constructor() {
        super('list', ['apps', 'items', 'types', 'names']);
    }

    get helpText(): string {
        return `${this.commandName} \tapps\r\n\titems <optional regex>\r\n\ttypes <optional regex>\r\n\tnames <optional regex>\tList the selected type with optional regex filter`;
    }

    tabTargets(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        let items: Map<string, IHaItem> = that.items.items;
        let possibles: string[];
        switch (parameters[1]) {
            case 'apps':
                return [];
            case 'items':
                possibles = [ ...items ]
                    .filter((item) => item[1].name.startsWith(parameters[2]))
                    .map((item) => item[1].name)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            case 'types':
                possibles = [ ...items ]
                    .filter(item => item[1].type.startsWith(parameters[2]))
                    .filter((item, index, self) => { 
                        return index == self.findIndex((innerItem) => innerItem[1].type == item[1].type)
                    })
                    .map((item) => item[1].type)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            case 'names':
                possibles = [ ...items ]
                    .filter(item => item[1].attributes?.friendly_name.startsWith(parameters[2]))
                    .map((item) => item[1].attributes.friendly_name)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            default:
                possibles = [];
            break;
        }
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            this.validateParameters(inputArray);
            let items: IHaItem[];
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

    _printItems(sock: IChannel, items: IHaItem[]): void {
        const TYPE: string = 'Type';
        const NAME: string = 'Name';
        const FRIENDLY: string ='Friendly Name';
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

    _listapps(that: ConsoleInterface, sock: IChannel): void {
        logger.debug('listapps called');
        that.controller.apps.forEach((app) => {
            sock.write(`${app.name} ${app.path} ${app.status}\r\n`);
        });
    }
}
