import { IApplication } from "../../common/IApplication";
import { IHaItem, IHaItemEditable, SafeItemAssign } from "../../haitems/haparentitem";
import { HaMain, State } from "../../hamain";
import { getLogger, Logger } from "log4js";
import * as https from 'https';

const CATEGORY: string = 'DynDnsUpdater';
const ONE_DAY: number = 86400;
var logger: Logger = getLogger(CATEGORY);

class DynDnsUpdater implements IApplication {
    private _external_ip: IHaItemEditable;
    private _lastUpdate: IHaItemEditable;
    private _user: string;
    private _updaterKey: string;
    private _hostname: string;
    private _errors: Map<string, string> = new Map<string, string>([
        [ 'badauth', 'DynDns authorization is invalid' ],
        [ 'notfqdn', 'This hostname not fully qualified' ],
        [ 'nohost', 'The host name is missing or invalid'],
        [ 'numhost', 'Attempted to update too many hosts in one call'],
        [ 'abuse', 'The specified host name has been blocked for abuse'],
        [ 'dnserr', 'Bad user name or password'],
        [ '911', 'Bad user name or password'],
    ]);
    private _url: string = null;
    public constructor(controller: HaMain, config: any) {
        // TODO Use a config file
        this._external_ip = SafeItemAssign(controller.items.getItem('var.external_ip'));
        this._lastUpdate = SafeItemAssign(controller.items.getItem('var.last_dns_update'));
        this._user = config.dyndnsupdater.user;
        this._updaterKey = config.dyndnsupdater.updaterKey;
        this._hostname = config.dyndnsupdater.hostname;
        logger.debug('Constructed');
    }

    public validate(_config: any): boolean {
        try {
            if (this._external_ip == undefined) throw new Error('Could not find externalIp item');
            if (this._lastUpdate == undefined) throw new Error('Could not find lastUpdate item');
            if (!this._user) throw new Error('user not found in config file');
            if (!this._updaterKey) throw new Error('updaterKey not found in config file');
            if (!this._hostname) throw new Error('hostname not found in config file');
        }
        catch (err: any) {
            logger.error((err as Error).message);
            return false;
        }

        this._url = `https://${this._user}:${this._updaterKey}@members.dyndns.org/v3/update?hostname=${this._hostname}&myip=`;
        return true;
    }

    public async run(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this._external_ip.on('new_state', (item: IHaItem, oldState: State) => {
                let now: Date = new Date();
                let then: Date = new Date(this._lastUpdate.state as string);

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

                    https.get(this._url + item.state, options, (res) => {
                        res.setEncoding('utf8');
                        res.on('data', (chunk: string) => allchunks += chunk);
                        res.on('end', () => {
                            logger.debug(`DynDns response: ${allchunks}`);
                            let rc = allchunks.split(' ')[0];
                            switch (rc) {
                                case 'good':
                                case 'nochg':
                                    // HACK Must be a better way to do this
                                    let nowString: string = now.getFullYear() + '-' +
                                                (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                                                now.getDate().toString().padStart(2, '0') + ' ' +
                                                now.getHours().toString().padStart(2, '0') + ':' +
                                                now.getMinutes().toString().padStart(2, '0') + ':' +
                                                now.getSeconds().toString().padStart(2, '0');
                                    this._lastUpdate.updateState(nowString);
                                    logger.info(`DynDns IP address successfully updated to ${item.state}`);
                                break;
                            default:
                                if (this._errors.has(rc)) {
                                    logger.error(this._errors.get(rc));
                                }
                                else {
                                    logger.error(`Update failed with unrecognized code: ${allchunks}`);
                                }
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


    public async stop(): Promise<void> {

    }
}

module.exports = DynDnsUpdater;