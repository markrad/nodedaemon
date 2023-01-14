import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaMain } from '../../hamain';
import { HaGenericUpdateableItem } from '../../haitems/hagenericupdatableitem';
import http from 'node:http';

const CATEGORY: string = 'TestBed';
var logger: Logger = getLogger(CATEGORY);

export default class DeviceTracker extends AppParent {
    private _deviceCount: HaGenericUpdateableItem;
    private _authKey: string;
    private _server: string;
    private _interval: number = 5 * 60;
    private _tracker: () => void;
    private _intTimer: NodeJS.Timer;
    private _url: URL;
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
        try {
            this._deviceCount = this.controller.items.getItemAs<HaGenericUpdateableItem>(HaGenericUpdateableItem, config.deviceCount, true);
            if (!config.authKey) throw new Error('Fing auth key must be provided');
            this._authKey = config.authKey
            if (!config.server) throw new Error('Server address must be provided');
            this._server = config.server;
            this._url = new URL(`http://${this._server}:49090/devices?auth=${this._authKey}`)
            if (config.interval != undefined) {
                this._interval = parseInt(config.interval);
                if (isNaN(this._interval)) throw new Error('Invterval is invalid - must be an integer');
            }
            logger.info('Validated successfully')
            return true;
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }
    }

    async run(): Promise<boolean> {
        this._tracker = () => {
            try {
                http.get(this._url, (res: http.IncomingMessage) => {
                    res.setEncoding('utf-8');
                    let body = '';
                    res.on('data', data => body += data);
                    res.on('end', () => {
                        try {
                            let devices = JSON.parse(body);
                            this._deviceCount.updateState(devices.length, false);
                        }
                        catch (err) {
                            logger.error(`Failed parsing devices JSON: ${err.message}`);
                        }
                    });
                });
            }
            catch (err) {
                logger.error(`Failed to acquire devices: ${err.message}`);
            }
        }
        return new Promise(async (resolve, _reject) => {
            this._tracker();
            this._intTimer = setInterval(this._tracker, this._interval * 1000);
            resolve(true);
        });
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            clearInterval(this._intTimer);
            resolve();
        });
    }
}
