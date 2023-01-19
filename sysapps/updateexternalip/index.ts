import { IHaItemEditable } from "../../haitems/ihaitemeditable";
import { HaMain } from "../../hamain";
import http from 'http';
import https from 'https'
import { getLogger, Logger } from "log4js";
import { AppParent } from '../../common/appparent';
import { HaGenericUpdateableItem } from "../../haitems/hagenericupdatableitem";
import { entityValidator, stringValidator, urlValidator } from "../../common/validator";
import { Url } from "url";
import { isValidCron } from 'cron-validator'
import * as schedule from 'node-schedule';

const CATEGORY = 'UpdateExternalIP';
var logger: Logger = getLogger(CATEGORY);

export default class UpdateExternalIP extends AppParent {
    private _external_ip: IHaItemEditable;
    private _urls: Url[] = [];
    private _schedule: schedule.Job;
    private _cron: string;
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
            this._cron = stringValidator.isValid(config.cron, { name: 'cron', noValueOk: false });
            if (!isValidCron(this._cron)) throw new Error(`Cron string ${this._cron} is invalid`);
            if (!config.servers || !Array.isArray(config.servers)) throw new Error('Servers are missing or invalid');
            this._urls = config.servers.map((server: any) => {
                return urlValidator.isValid(server.url)
            });
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }
        logger.info('Validated successfully');
        return true;
    }

    public async run(): Promise<boolean> {
        return new Promise<boolean>((resolve, _reject) => {
            let updater: () => void = async (): Promise<void> => {
                let success: boolean = false;
                for (let i = 0; i < this._urls.length; i++) {
                    try {
                        let currentIP: string = await this._whatsMyIP(this._urls[i]);
                        logger.info(`Updating external IP address to ${currentIP}`);
                        this._external_ip.updateState(currentIP, false);
                        success = true;
                        break;
                    }
                    catch (err) {
                        logger.warn(`Server ${this._urls[i].hostname} returned an error - ${err}`);
                    }
                }

                if (!success) logger.error('Failed to contact any IP servers');
            }
            this._schedule = schedule.scheduleJob(this._cron, updater);
            updater();
            resolve(true);
        });
    }

    public async stop(): Promise<void> {
        this._schedule.cancel();
    }

    private async _whatsMyIP(url: Url): Promise<string> {
        const IP_HOST = 'api.ipify.org';
        return new Promise((resolve, reject) => {
            let client = url.protocol == 'https'? https : http;
            let allchunks: string = '';
    
            client.get(url, (res: any) => {
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
