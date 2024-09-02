import { getLogger, Logger } from "log4js";
import { CommandBase, CommandInfo } from './commandbase'; 
import ConsoleInterface from ".";
import { IChannel } from "./ichannel";
import { IHaItem } from "../../haitems/ihaitem";
import { IChannelWrapper } from "./ichannelwrapper";
import { AppInfo } from '../../hamain/appinfo'

const CATEGORY: string = 'CommandList';
var logger: Logger = getLogger(CATEGORY);

const commandInfo: CommandInfo = {
    commandName: 'list',
    subcommands: [ 
        {
            subcommandName: 'apps',
            description: 'List the apps'
        },
        {
            subcommandName: 'items',
            subcommandParm: '<regex>',
            description: 'List entities with entity name that matches <regex>'
        },
        {
            subcommandName: 'types',
            subcommandParm: '<regex>',
            description: 'List entities with entity type that matches <regex>'
        },
        {
            subcommandName: 'names',
            subcommandParm: '<regex>',
            description: 'List entities with friendly name that matches <regex>'
        },
    ]
}

class CommandList extends CommandBase {
    public constructor() {
        super(commandInfo);
    }

    public get helpText(): string {
        return `${this.commandName} \tapps\r\n\titems <optional regex>\r\n\ttypes <optional regex>\r\n\tnames <optional regex>\tList the selected type with optional regex filter`;
    }

    public tabTargets(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
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
                    .filter((item) => (item[1].friendlyName?? '').startsWith(parameters[2]))
                    .map((item) => item[1].friendlyName)
                    .sort((l, r) => l < r? -1 : 1);
            break;
            default:
                possibles = [];
            break;
        }
        return (possibles.length == 1 || tabCount > 1)? possibles : [];
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        try {
            this._validateParameters(inputArray);
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
                    items = inputArray[2]
                        ? that.items.getItemByFriendly(inputArray.slice(2).join(' '), true) 
                        : that.items.getItemByFriendly();
                    this._printItems(sock, items);
                break;
            }
            return 0;
        }
        catch (err) {
            this._displayError(logger, sock, err);
            return 4;
        }
    }

    private _printItems(sock: IChannel, items: IHaItem[]): void {
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
            items.forEach((item) => sock.write(`${item.type.padEnd(maxType)}${item.name.padEnd(maxName)}${item.friendlyName}\r\n`));
        }
    }

    private _listapps(that: ConsoleInterface, sock: IChannel): void {
        logger.debug('listapps called');
        let maxNameLen = 2 + Math.max(...that.controller.apps.map((item) => item.name.length));
        let maxPathLen = 2 + Math.max(...that.controller.apps.map((item) => item.path.length));
        that.controller.apps
            .sort((l, r) => {
                return l.name < r.name
                ? -1
                : l.name > r.name
                ? 1
                : 0;
            })
            .forEach((app: AppInfo) => {
            sock.write(`${app.name}${' '.repeat(maxNameLen - app.name.length)}${app.path}${' '.repeat(maxPathLen - app.path.length)}${app.status}\r\n`);
        });
    }
}

export const factory = new CommandList();