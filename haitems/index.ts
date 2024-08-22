import { promises as fs } from 'fs';
import log4js from 'log4js';
import { IHaItem } from './ihaitem';
import { LoggerLevel } from '../hamain';

const CATEGORY: string = 'HaItemFactory';
var logger: any = log4js.getLogger(CATEGORY);
logger.level = 'info';

export class HaItemFactory {
    private _itemClasses: any;
    private _loggerLevels: LoggerLevel[];

    public constructor(loggerLevels: LoggerLevel[]) {
        this._loggerLevels = loggerLevels;
        this._itemClasses = {};
        this._getItemObjects()
            .then(() => logger.debug('Objects acquired'))
            .catch((err) => {
                logger.error('Unable to walk directory of haitems');
                throw (err);
            });
    }

    public getItemObject(item: any): IHaItem {
        // BUG This breaks when Home Assistant is restarted due to trying to get events during that restart period - maybe fixed now
        // BUG This is NOT FIXED
        try {
            let itemType: string = item.entity_id.split('.')[0];
            let logLevel: string = null;

            if (this._loggerLevels) {
                let ll: LoggerLevel = null;
                if ((ll = this._loggerLevels.find((value: LoggerLevel) => value.entityId == item.entity_id))) {
                    logLevel = ll.level;
                    ll.used = true;
                }
            }
            
            if (logLevel) logger.info(`Set logging to ${logLevel} for ${item.entity_id}`);

            if (item?.attributes?.addedBy == 'nodedaemon') {
                return new this._itemClasses['usersensor'](item, logLevel);
            }
            else if (itemType in this._itemClasses) {
                return new this._itemClasses[itemType](item, logLevel);
            }
            else {
                return new this._itemClasses['unknown'](item , logLevel);
            }
        }
        catch (err) {
            logger.error(`This should not happen: ${err.message}`);
        }
    }

    private async _getItemObjects(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const dir = await fs.opendir(__dirname);

                for await (const dirent of dir) {
                    if (dirent.name.startsWith('haitem') && dirent.name.endsWith('.js')) {
                        let itemType = dirent.name.split('.')[0].substr(6);
                        this._itemClasses[itemType] = (await import('./' + dirent.name)).default;
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
