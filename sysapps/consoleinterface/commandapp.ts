import { ConsoleInterface, IChannel } from ".";
import { AppInfo } from "../../hamain";
import { getLogger } from "log4js";
import { CommandBase } from './commandbase';

const CATEGORY: string = 'CommandApp';
var logger = getLogger(CATEGORY);

export class CommandApp extends CommandBase {
    constructor() {
        super('app', ['start', 'stop', 'list']);
    }

    get helpText(): string {
        return `${this.commandName}\tstart appname\r\n\tstop appname\r\n\tlist\t\t\tStart or stop the specified app or list all apps (same as list apps)`;
    }

    async _appStart(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
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

    async _appStop(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        return new Promise(async (resolve, reject) => {
            logger.debug('app stop called');
            let appName: string = inputArray[2];
            let aps: AppInfo[] = that.controller.apps.filter((item) =>item.name == appName);
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

    _listapps(_inputArray: string[], that: ConsoleInterface, sock: IChannel): void {
        logger.debug('app list called');
        that.controller.apps.forEach((app: AppInfo) => {
            sock.write(`${app.name} ${app.path} ${app.status}\r\n`);
        });
    }

    tabTargets(that: ConsoleInterface, tabCount: number, parameters: string[]): string[] {
        let possibles: string[] = that.controller.apps.filter((app) => app.name.startsWith(parameters[2])).map((app) => app.name);
        
        if (possibles.length == 0 || (tabCount < 2 && possibles.length > 1)) {
            return [];
        }
        else {
            return possibles;
        }
    }

    async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            this.validateParameters(inputArray);
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
