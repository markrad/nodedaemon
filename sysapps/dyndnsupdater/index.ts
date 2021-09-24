import { IApplication } from "../../common/IApplication";
import { IHaItem, IHaItemEditable, SafeItemAssign } from "../../haitems/haparentitem";
import { HaMain, State } from "../../hamain";
import { getLogger, Logger } from "log4js";
import * as https from 'https';
import { Dayjs } from "dayjs";
import { LogLevelValidator } from '../../common/loglevelvalidator';

const CATEGORY: string = 'DynDnsUpdater';
const ONE_DAY: number = 24;                     // Just simple hours
var logger: Logger = getLogger(CATEGORY);

class DynDnsUpdater implements IApplication {
    private _externalIp: IHaItemEditable;
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
        this._externalIp = SafeItemAssign(controller.items.getItem(config.dyndnsupdater.externalIp));
        this._lastUpdate = SafeItemAssign(controller.items.getItem(config.dyndnsupdater.lastUpdate));
        this._user = config.dyndnsupdater.user;
        this._updaterKey = config.dyndnsupdater.updaterKey;
        this._hostname = config.dyndnsupdater.hostname;
        logger.info('Constructed');
    }

    public validate(_config: any): boolean {
        try {
            if (this._externalIp == undefined || this._externalIp.type != 'var') throw new Error('Config value externalIp is missing or invalid (must be type var)');
            if (this._lastUpdate == undefined || this._lastUpdate.type != 'var') throw new Error('Config value lastUpdate is missing or invalid (must be type var)');
            if (!this._user) throw new Error('user not found in config file');
            if (!this._updaterKey) throw new Error('updaterKey not found in config file');
            if (!this._hostname) throw new Error('hostname not found in config file');
        }
        catch (err: any) {
            logger.error((err as Error).message);
            return false;
        }

        this._url = `https://${this._user}:${this._updaterKey}@members.dyndns.org/v3/update?hostname=${this._hostname}&myip=`;
        logger.info('Validated successfully');
        return true;
    }

    public async run(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this._externalIp.on('new_state', (item: IHaItem, oldState: State) => {
                let now: Dayjs = new Dayjs();
                let then: Dayjs = new Dayjs(this._lastUpdate.state as string);

                if (isNaN(then.year())) {
                    then = new Dayjs(0);
                }
        
                // Update when IP address changes or at least once every 24 hours
                if (now.diff(then, 'hours') >= ONE_DAY || item.state != oldState.state) {
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
                                    this._lastUpdate.updateState(now.format('YYYY-MM-DD HH:mm:ss'));
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

module.exports = DynDnsUpdater;