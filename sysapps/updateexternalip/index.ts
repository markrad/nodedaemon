import { IHaItemEditable, SafeItemAssign } from "../../haitems/haparentitem";
import { HaMain } from "../../hamain";
import http from 'http';
import { getLogger, Logger } from "log4js";
import { AppParent } from '../../common/appparent';

const CATEGORY = 'UpdateExternalIP';
var logger: Logger = getLogger(CATEGORY);

class UpdateExternalIP extends AppParent {
    private _external_ip: IHaItemEditable;
    private _interval: NodeJS.Timer = null;
    private _multiplier: number = 24;
    private _delay: number = 5;
    private _controller: HaMain;
    public constructor(controller: HaMain, _config: any) {
        super(logger);
        this._controller = controller;
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        if (!config.ip) throw new Error('External IP variable is missing');
        this._external_ip = SafeItemAssign(this._controller.items.getItem(config.ip));   
        if (!this._external_ip) throw new Error(`Unable to find ip variable ${config.ip}`);
        if (this._external_ip.type != 'var') throw new Error(`IP variable ${config.ip} is not a type var`);
        logger.info('Validated successfully');
        return true;
    }

    public async run(): Promise<boolean> {
        let counter = 0;

        this._interval = setInterval(async (multiplier) => {
            if (++counter % multiplier == 0) {
                counter = 0;
                try {
                    let currentIP = await this._whatsMyIP();

                    logger.info(`Updating external IP address to ${currentIP}`);
                    this._external_ip.updateState(currentIP);
                }
                catch (err) {
                    logger.error(`Could not get IP address: ${err}`);
                }
            }
        }, this._delay * 1000, this._multiplier);

        return true;
    }

    public async stop(): Promise<void> {
        clearInterval(this._interval);
    }

    private async _whatsMyIP(): Promise<string> {
        const IP_HOST = 'api.ipify.org';
        return new Promise((resolve, reject) => {
            const options = {
                host: IP_HOST,
                port: 80,
                path: '/',
            };
    
            let allchunks: string = '';
    
            http.get(options, (res: any) => {
                if (res.statusCode != 200) {
                    let err: Error = new Error(`Error status code returned from IP server ${res.statusCode}`);
                    logger.error(err.message);
                    reject(err)
                }
                res.setEncoding('utf8');
                res.on('data', (chunk: string) => allchunks += chunk);
                res.on('end', () => resolve(allchunks));
            }).on('error', (err: Error) => {
                logger.error(`Failed to connect to ${IP_HOST}: ${err}`);
                reject(err);
            });
        });
    }
}

module.exports = UpdateExternalIP;