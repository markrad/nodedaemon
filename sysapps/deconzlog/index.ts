import { WSWrapper } from '../../common/wswrapper';
import { getLogger, Logger } from 'log4js';
import { IApplication } from '../../common/IApplication';
import { HaMain } from '../../hamain';
import { LogLevelValidator } from '../../common/loglevelvalidator';

const CATEGORY: string = 'DeconzLog';
var logger: Logger = getLogger(CATEGORY);

export class DeconzLog implements IApplication {
    _deconz: any;
    _ws: WSWrapper;
    constructor(_controller: HaMain, config: any) {
        this._deconz = { ...{ host: '127.0.0.1', port: 8443}, ...(config.deconzlog.deconz ?? {}) };
        this._ws = null;
        logger.info('Constructed');
    }

    validate(_config: any): boolean {
        // Since this is test code we don't do much in here
        return true;
    }

    async run(): Promise<boolean> {
        return new Promise(async (resolve, _reject) => {
            this._ws = new WSWrapper(`ws://${this._deconz.host}:${this._deconz.port}`, 60);
            this._ws.on('message', (msg: string) => {
                var msgData: any = JSON.parse(msg);
                logger.debug(`Received:\n${JSON.stringify(msgData, null, 2)}`);
            });
            await this._ws.open();
            logger.info('Connected to deCONZ server');
            resolve(true);
        });
    }

    send(data: string | Buffer) {
        this._ws.send(data);
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            await this._ws.close();
            resolve();
        });
    }

    public get logging(): string {
        return logger.level;
    }

    public set logging(value: string) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            logger.error(err.message);
            throw err;
        }
        else {
            logger.level = value;
        }
    }
}

module.exports = DeconzLog;
