import { ConsoleInterface } from ".";
import { AppInfo } from "../../hamain";
import { getLogger } from "log4js";
import { CommandBase } from './commandbase';
import { IChannel } from "./ichannel";
import { LogLevels } from '../../common/loglevelvalidator';

const CATEGORY: string = 'CommandApp';
var logger = getLogger(CATEGORY);

export class CommandApp extends CommandBase {
    public constructor() {
        super('app', ['start', 'stop', 'list', 'log']);
    }

    public get helpText(): string {
        // TODO Fix help string
        let help: string = 
`${this.commandName}     start appname           start the specified app\r
        stop appname            stop the specified app\r
        list                    list apps\r
        log appname <level>     get log level or set log level to <level>\r
                                where <level> = ${LogLevels().join(' | ').toLowerCase()}`;
        return help;                                        
        // return `${this.commandName}\tstart appname\r\n\tstop appname\r\n\tlist\t\t\tStart or stop the specified app or list all apps (same as list apps)`;
    }

    private async _appStart(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        return new Promise(async (resolve, reject) => {
            logger.debug('app start called');
            let appName: string = inputArray[2];
            let aps: AppInfo[] = that.controller.apps.filter((item) =>item.name == appName);
            try {
                if (aps.length != 1) {
                    return reject(new Error(`App ${inputArray[2]} does not exist`));
                }
                if (aps[0].status == 'running') {
                    return reject(new Error(`Cannot start app ${aps[0].name} - already running`));
                }
                else {
                    await aps[0].instance.run();
                    aps[0].status = 'running';
                    sock.write(`App ${aps[0].name} started\r\n`);
                }
            }
            catch (err: any) {
                logger.debug(`Failed to start app ${appName}: ${err.message}`);
                aps[0].status = 'failed';
                return reject(new Error(`Failed to start app ${appName}: ${err.message}`));
            }

            return resolve();
        });
    }

    private async _appStop(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        return new Promise(async (resolve, reject) => {
            logger.debug('app stop called');
            let appName: string = inputArray[2];
            let aps: AppInfo[] = that.controller.apps.filter((item) => item.name == appName);
            try {
                if (aps.length != 1) {
                    return reject(new Error(`App ${inputArray[2]} does not exist`));
                }
                if (aps[0].status != 'running') {
                    return reject(new Error(`Cannot stop app ${aps[0].name} - status is ${aps[0].status}\r\n`));
                }
                else {
                    await aps[0].instance.stop();
                    aps[0].status = 'stopped';
                    sock.write(`App ${aps[0].name} stopped\r\n`)
                }
            }
            catch (err: any) {
                logger.debug(`Failed to stop app ${appName}: ${err.message}`);
                aps[0].status = 'failed';
                return reject(new Error(`Failed to stop app ${appName}: ${err.message}`));
            }

            return resolve();
        });
    }

    private _listapps(_inputArray: string[], that: ConsoleInterface, sock: IChannel): void {
        logger.debug('app list called');
        that.controller.apps.forEach((app: AppInfo) => {
            sock.write(`${app.name} ${app.path} ${app.status}\r\n`);
        });
    }

    private _applog(inputArray: string[], that: ConsoleInterface, sock: IChannel): void {
        logger.debug('app log called');
        let appName: string = inputArray[2];
        let aps: AppInfo[] = that.controller.apps.filter((item) => item.name == appName);
        try {
            if (aps.length != 1) {
                throw new Error(`App ${inputArray[2]} does not exist`);
            }
            if (aps[0].status != 'running') {
                throw new Error(`Cannot view or modify logging for ${aps[0].name} - status is ${aps[0].status}\r\n`);
            }
            else {
                if (inputArray.length == 3) {
                    sock.write(`App ${aps[0].name} has log level ${aps[0].instance.logging}\r\n`);
                }
                else {
                    aps[0].instance.logging = inputArray[3];
                    sock.write(`App ${aps[0].name} has log level ${aps[0].instance.logging}\r\n`);
                }
            }
        }
        catch (err: any) {
            logger.debug(`Failed to get or set logging for ${appName}: ${err.message}`);
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

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
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
        }
        catch (err: any) {
            logger.error(`${err}`);
            sock.write(`${err}\r\n`);
            sock.write('Usage:\r\n');
            sock.write(this.helpText);
            sock.write('\r\n');
        }
    }
}
