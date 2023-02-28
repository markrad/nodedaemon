import ConsoleInterface from ".";
import { AppInfo, AppStatus } from '../../hamain/appinfo'
import { getLogger, Logger } from "log4js";
import { CommandBase, CommandInfo } from './commandbase';
import { IChannelWrapper } from "./ichannelwrapper";
import { LogLevels } from '../../common/loglevelvalidator';

const CATEGORY: string = 'CommandApp';
var logger: Logger = getLogger(CATEGORY);

const commandInfo: CommandInfo = {
    commandName: 'app',
    subcommands: [ 
        {
            subcommandName: 'start',
            subcommandParm: '[appname]',
            description: 'Start the app [appname]'
        },
        {
            subcommandName: 'stop',
            subcommandParm: '[appname]',
            description: 'Stop the app [appname]'
        },
        {
            subcommandName: 'restart',
            subcommandParm: '[appname]',
            description: 'Restart the app [appname]'
        },
        {
            subcommandName: 'list',
            description: 'List the apps'
        },
        {
            subcommandName: 'log',
            subcommandParm: '[appname] <level>',
            description: 'Get or set logging for [appname]',
            description2: 'where <level> = trace | debug | info | warn | error | fatal'
        },
    ] 
}

class CommandApp extends CommandBase {
    public constructor() {
        super(commandInfo);
    }

    public get helpText(): string {
        let help: string = 
`${this.commandName}     start appname           start the specified app\r
        stop appname            stop the specified app\r
        restart appname         restart app with new configuration settings\r
        list                    list apps\r
        log appname <level>     get log level or set log level to <level>\r
                                where <level> = ${LogLevels().join(' | ').toLowerCase()}`;
        return help;                                        
        // return `${this.commandName}\tstart appname\r\n\tstop appname\r\n\tlist\t\t\tStart or stop the specified app or list all apps (same as list apps)`;
    }

    private async _appStart(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<void> {
        return new Promise(async (resolve, reject) => {
            logger.debug('app start called');
            let appName: string = inputArray[2];
            let app: AppInfo = that.controller.getApp(appName);
            try {
                if (!app) {
                    return reject(new Error(`App ${inputArray[2]} does not exist`));
                }
                else {
                    await that.controller.startApp(app);
                    sock.write(`App ${app.name} started\r\n`);
                }
            }
            catch (err: any) {
                logger.debug(`Failed to start app ${appName}: ${err.message}`);
                return reject(new Error(`Failed to start app ${appName}: ${err.message}`));
            }

            resolve();
        });
    }

    private async _appStop(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<void> {
        return new Promise(async (resolve, reject) => {
            logger.debug('app stop called');
            let appName: string = inputArray[2];
            let app: AppInfo = that.controller.getApp(appName);
            try {
                if (!app) {
                    reject(new Error(`App ${inputArray[2]} does not exist`));
                }
                else {
                    await that.controller.stopApp(app);
                    sock.write(`App ${app.name} stopped\r\n`)
                }
            }
            catch (err: any) {
                let msg: string = `Failed to stop app ${appName}: ${err.message}`;
                logger.debug(msg);
                reject(new Error(msg));
            }

            resolve();
        });
    }

    private async _appRestart(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<void> {
        return new Promise(async (resolve, reject) => {
            logger.debug('app reload called');
            let appName: string = inputArray[2];
            let app: AppInfo = that.controller.getApp(appName);
            try {
                if (!app) {
                    return reject(new Error(`App ${inputArray[2]} does not exist`));
                }

                that.controller.restartApp(app);
                sock.write(`App ${app.name} restarted\r\n`);
            }
            catch (err: any) {
                logger.debug(`Failed to restart app ${appName}: ${err.message}`);
                return reject(new Error(`Failed to restart app ${appName}: ${err.message}`));
            }

            return resolve();
        })
    }

    private _listapps(_inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): void {
        logger.debug('app list called');
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

    private _applog(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): void {
        logger.debug('app log called');
        let app = that.controller.getApp(inputArray[2]);
        try {
            if (!app) {
                throw new Error(`App ${inputArray[2]} does not exist`);
            }
            if (app.status != AppStatus.RUNNING) {
                throw new Error(`Cannot view or modify logging for ${app.name} - status is ${app.status}\r\n`);
            }
            else {
                if (inputArray.length == 3) {
                    sock.write(`App ${app.name} has log level ${app.instance.logging}\r\n`);
                }
                else {
                    app.instance.logging = inputArray[3];
                    logger.info(`Logging for ${app.name} set to ${app.instance.logging}`);
                    sock.write(`App ${app.name} has log level ${app.instance.logging}\r\n`);
                }
            }
        }
        catch (err: any) {
            logger.debug(`Failed to get or set logging for ${inputArray[2]}: ${err.message}`);
            throw err;
        }
}

    public tabTargets(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        let possibles: string[];
        if (parameters.length == 3) {
            possibles = that.controller.apps.filter((app) => app.name.startsWith(parameters[2])).map((app) => app.name);
        }
        else if (parameters.length == 4) {
            possibles = LogLevels().join('|').toLowerCase().split('|').filter((item) => item.startsWith(parameters[3]));
        }
        
        if (possibles.length == 0 || (tabCount < 2 && possibles.length > 1)) {
            return [];
        }
        else {
            return possibles;
        }
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannelWrapper): Promise<number> {
        try {
            this._validateParameters(inputArray);
            switch (inputArray[1]) {
                case "start":
                    if (inputArray.length != 3) {
                        throw new Error('Missing or invalid arguments');
                    }
                    await this._appStart(inputArray, that, sock);
                break;
                case "stop":
                    if (inputArray.length != 3) {
                        throw new Error('Missing or invalid arguments');
                    }
                    await this._appStop(inputArray, that, sock);
                break;
                case "restart":
                    if (inputArray.length != 3) {
                        throw new Error('Missing or invalid arguments');
                    }
                    await this._appRestart(inputArray, that, sock);
                break;
                case "log":
                    if (inputArray.length < 3 || inputArray.length > 4) {
                        throw new Error('Missing or invalid arguments');
                    }
                    this._applog(inputArray, that, sock);
                break;
                case "list":
                    if (inputArray.length != 2) {
                        throw new Error('Excessive arguments');
                    }
                    this._listapps(inputArray, that, sock);
                break;
            }

            return 0;
        }
        catch (err: any) {
            this._displayError(logger, sock, err);
            return 4;
        }
    }
}

export const factory = new CommandApp();
