import { promises as fs } from 'fs';
import log4js from 'log4js';
// import { HaInterface } from '../hainterface';
import { IHaItem } from './ihaitem';

const CATEGORY: string = 'HaItemFactory';
var logger: any = log4js.getLogger(CATEGORY);
logger.level = 'info';

export class HaItemFactory {
    private _itemClasses: any;
    private _config: any;

    public constructor(config: any) {
        this._config = config;
        this._itemClasses = {};
        this._getItemObjects()
            .then(() => logger.debug('Objects acquired'))
            .catch((err) => {
                logger.error('Unable to walk directory of haitems');
                throw (err);
            });
    }

    public getItemObject(item: any): IHaItem {
        let itemType: string = item.entity_id.split('.')[0];
        let logLevel: any = null;

        if (this._config.main.loggerLevelOverrides){
            logLevel = this._config.main.loggerLevelOverrides.find((value: any) => value.hasOwnProperty(item.entity_id));
        }
        
        if (logLevel) logger.info(`Set logging to ${logLevel[item.entity_id]} for ${item.entity_id}`);
        if (item?.attributes?.addedBy == 'nodedaemon') {
            return new this._itemClasses['usersensor'](item, logLevel? logLevel[item.entity_id] : undefined);
        }
        else if (itemType in this._itemClasses) {
            return new this._itemClasses[itemType](item, logLevel? logLevel[item.entity_id] : undefined);
        }
        else {
            return new this._itemClasses['unknown'](item , logLevel?.item.entity_id);
        }
    }

    private async _getItemObjects(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const dir = await fs.opendir(__dirname);

                for await (const dirent of dir) {
                    if (dirent.name.startsWith('haitem') && dirent.name.endsWith('.js')) {
                        let itemType = dirent.name.split('.')[0].substr(6);
                        this._itemClasses[itemType] = require('./' + dirent.name);
                    }
                }

                resolve();
            }
            catch(err) {
                reject(err);
            }
        });
    }
}
