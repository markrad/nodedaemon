import { AppParent } from '../../common/appparent';
import { IHaItem } from "../../haitems/ihaitem";
import { IHaItemEditable } from "../../haitems/haparentitem";
import { HaMain } from "../../hamain";
import { State } from '../../hamain/state';
import { getLogger, Logger } from "log4js";
import * as https from 'https';
import { Dayjs } from "dayjs";
import { HaGenericUpdateableItem } from '../../haitems/hagenericupdatableitem';

const CATEGORY: string = 'DynDnsUpdater';
const ONE_DAY: number = 24;                     // Just simple hours
var logger: Logger = getLogger(CATEGORY);

export default class DynDnsUpdater extends AppParent {
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
        super(logger);
        this._externalIp = controller.items.getItemAs(HaGenericUpdateableItem, config.dyndnsupdater.externalIp) as HaGenericUpdateableItem;
        this._lastUpdate = controller.items.getItemAs(HaGenericUpdateableItem, config.dyndnsupdater.lastUpdate) as HaGenericUpdateableItem;
        this._user = config.dyndnsupdater?.user;
        this._updaterKey = config.dyndnsupdater?.updaterKey;
        this._hostname = config.dyndnsupdater?.hostname;
        logger.info('Constructed');
    }

    public validate(_config: any): boolean {
        try {
            if (this._externalIp == null || !this._externalIp.isEditable) throw new Error('Config value externalIp is missing or invalid (must be editable)');
            if (this._lastUpdate == null || !this._lastUpdate.isEditable) throw new Error('Config value lastUpdate is missing or invalid (must be editable)');
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
}
