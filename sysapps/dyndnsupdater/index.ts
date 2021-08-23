import { IApplication } from "../../common/IApplication";
import { HaParentItem, IHaItem, IHaItemEditable, IHaItemSwitch, SafeItemAssign } from "../../haitems/haparentitem";
import { HaMain, State } from "../../hamain";
import { getLogger, Logger } from "log4js";
import * as https from 'https';
// TODO Minimum conversion

//const https = require('https');

const CATEGORY: string = 'DynDnsUpdater';
const ONE_DAY: number = 86400;
var logger: Logger = getLogger(CATEGORY);

class DynDnsUpdater implements IApplication {
    external_ip: IHaItemEditable;
    lastUpdate: IHaItemEditable;
    user: string;
    updaterKey: string;
    hostname: string;
    // updateTime: Date;
    constructor(controller: HaMain, config: any) {
        // TODO Use a config file
        this.external_ip = SafeItemAssign(controller.items.getItem('var.external_ip'));
        this.lastUpdate = SafeItemAssign(controller.items.getItem('var.last_dns_update'));
        this.user = config.dyndnsupdater.user;
        this.updaterKey = config.dyndnsupdater.updaterKey;
        this.hostname = config.dyndnsupdater.hostname;
        logger.debug('Constructed');
    }

    validate(config: any): boolean {
        try {
            if (this.external_ip == undefined) throw new Error('Could not find externalIp item');
            if (this.lastUpdate == undefined) throw new Error('Could not find lastUpdate item');
            if (!this.user) throw new Error('user not found in config file');
            if (!this.updaterKey) throw new Error('updaterKey not found in config file');
            if (!this.hostname) throw new Error('hostname not found in config file');
        }
        catch (err: any) {
            logger.error((err as Error).message);
            return false;
        }
        return true;
    }

    async run(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.external_ip.on('new_state', (item: IHaItem, oldState: State) => {
                let now: Date = new Date();
                let then: Date = new Date(this.lastUpdate.state);

                if (isNaN(then.getDate())) {
                    then = new Date(0);
                }
        
                // Update when IP address changes or at least once every 24 hours
                if (now.valueOf() / 1000 - then.valueOf() / 1000 > ONE_DAY || item.state != oldState.state) {
                    logger.info(`Updating DynDNS IP address to ${item.state}`);
                    let allchunks: string = '';
                    let options: any = {
                        headers: {
                            'User-Agent': 'Radrealm - HassTest - v0.0.1'
                        }
                    };

                    https.get(`https://${this.user}:${this.updaterKey}@members.dyndns.org/v3/update?hostname=${this.hostname}&myip=${item.state}`, options, (res) => {
                        res.setEncoding('utf8');
                        res.on('data', (chunk: string) => allchunks += chunk);
                        res.on('end', () => {
                            logger.debug(`DynDns response: ${allchunks}`);
                            switch (allchunks.split(' ')[0]) {
                            case 'good':
                            case 'nochg':
                                let nowString: string = now.getFullYear() + '-' +
                                            (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                                            now.getDate().toString().padStart(2, '0') + ' ' +
                                            now.getHours().toString().padStart(2, '0') + ':' +
                                            now.getMinutes().toString().padStart(2, '0') + ':' +
                                            now.getSeconds().toString().padStart(2, '0');
                                this.lastUpdate.updateState(nowString);
                                logger.info(`DynDns IP address successfully updated to ${item.state}`);
                                break;
                            case 'badauth':
                                logger.error('DynDns authorization is invalid');
                                break;
                            case 'notfqdn':
                                logger.error('This hostname not fully qualified');
                                break;
                            case 'nohost':
                                logger.error('The host name is missing or invalid');
                                break;
                            case 'numhost':
                                logger.error('Attempted to update too many hosts in one call');
                                break;
                            case 'abuse':
                                logger.error('The specified host name has been blocked for abuse');
                                break;
                            case 'dnserr':
                            case '911':
                                logger.error('Bad user name or password');
                                break;
                            default:
                                logger.error(`Update failed with unrecognized code: ${allchunks}`);
                            }
                        });
                    }).on('error', (err) => {
                        logger.error(`Failed to update IP address: ${err}`);
                        reject(err);
        
                    });
                }
            });

            resolve(true);
        });
    }


    async stop(): Promise<void> {

    }
}

module.exports = DynDnsUpdater;