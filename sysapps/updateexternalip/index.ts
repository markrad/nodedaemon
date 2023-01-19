import { IHaItemEditable } from "../../haitems/ihaitemeditable";
import { HaMain } from "../../hamain";
import http from 'http';
import https from 'https'
import { getLogger, Logger } from "log4js";
import { AppParent } from '../../common/appparent';
import { HaGenericUpdateableItem } from "../../haitems/hagenericupdatableitem";
import { entityValidator } from "../../common/validator";

const CATEGORY = 'UpdateExternalIP';
var logger: Logger = getLogger(CATEGORY);

type IPServer = {
    protocol: string,
    url: string,
    port?: number,
    path?: string;
}

export default class UpdateExternalIP extends AppParent {
    private _external_ip: IHaItemEditable;
    private _interval: NodeJS.Timer = null;
    private _multiplier: number = 24;
    private _delay: number = 5;
    private static readonly servers: IPServer[] = [
        { protocol: 'http', url: 'api.ipify.org' },
        { protocol: 'https', url: 'api.my-ip.io', path: 'ip' }
    ]
    public constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
        try {
            this._external_ip = entityValidator.isValid(config.ip, { entityType: HaGenericUpdateableItem, name: 'external IP'});
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }
        logger.info('Validated successfully');
        return true;
    }

    public async run(): Promise<boolean> {
        let counter = 0;

        this._interval = setInterval(async (multiplier) => {
            if (++counter % multiplier == 0) {
                counter = 0;
                try {
                    let currentIP = await this._whatsMyIP(UpdateExternalIP.servers[0]);

                    logger.info(`Updating external IP address to ${currentIP}`);
                    this._external_ip.updateState(currentIP, false);
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

    private async _whatsMyIP(server: IPServer): Promise<string> {
        const IP_HOST = 'api.ipify.org';
        return new Promise((resolve, reject) => {
            const options = {
                host: server.url,
                port: (server.port? server.port : server.protocol == 'https'? 443 : 80),
                path: (server.path? server.path : '/'),
            };

            let client = server.protocol == 'https'? https : http;
    
            let allchunks: string = '';
    
            client.get(options, (res: any) => {
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
