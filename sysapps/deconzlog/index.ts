import { WSWrapper } from '../../common/wswrapper';
import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaMain } from '../../hamain';

const CATEGORY: string = 'DeconzLog';
var logger: Logger = getLogger(CATEGORY);

export default class DeconzLog extends AppParent {
    _deconz: any;
    _ws: WSWrapper;
    constructor(controller: HaMain, config: any) {
        super(controller, logger);
        this._deconz = { ...{ host: '127.0.0.1', port: 8443}, ...(config.deconzlog.deconz ?? {}) };
        this._ws = null;
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
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
}
