import { IHaItemEditable, SafeItemAssign } from "../../haitems/haparentitem";
import { HaMain } from "../../hamain";
import http from 'http';
import { getLogger } from "log4js";

const CATEGORY = 'UpdateExternalIP';
var logger = getLogger(CATEGORY);

class UpdateExternalIP {
    external_ip: IHaItemEditable;
    interval: NodeJS.Timer;
    config: any;
    multiplier: number = 24;
    delay: number = 5;
    constructor(controller: HaMain, config: any) {
        this.external_ip = SafeItemAssign(controller.items.getItem('var.external_ip'));
        this.config = config;
        this.delay = 5;
        this.multiplier = 24;       // Check every two minutes
        this.interval = null;
        logger.debug('Constructed');
    }

    async run() {
        let counter = 0;

        this.interval = setInterval(async (multiplier) => {
            if (++counter % multiplier == 0) {
                counter = 0;
                try {
                    let currentIP = await this.whatsMyIP();

                    logger.info(`Updating external IP address to ${currentIP}`);
                    this.external_ip.updateState(currentIP);
                }
                catch (err) {
                    logger.error(`Could not get IP address: ${err}`);
                }
            }
        }, this.delay * 1000, this.multiplier);
    }

    async stop() {
        clearInterval(this.interval);
    }

    async whatsMyIP(): Promise<string> {
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