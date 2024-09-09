import { promises as fs } from 'fs';
import log4js from 'log4js';
import { IHaItem, IHaItemConstructor } from './ihaitem';
import { LoggerLevel } from '../hamain';
import path from 'path';

const CATEGORY: string = 'HaItemFactory';
var logger: any = log4js.getLogger(CATEGORY);
logger.level = 'info';

export class HaItemFactory {
    private static _itemClasses: Map<string, IHaItemConstructor>;
    private _loggerLevels: LoggerLevel[];

    public static async createItemFactory(loggerLevels: LoggerLevel[]): Promise<HaItemFactory> {
        return new Promise<HaItemFactory>(async (resolve, reject) => {
            try {
                HaItemFactory._itemClasses = await HaItemFactory._getItemObjects();
                resolve(new HaItemFactory(loggerLevels));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Constructs a new instance of the `HaItems` class.
     * 
     * @param loggerLevels - An array of logger levels.
     */
    private constructor(loggerLevels: LoggerLevel[]) {
        this._loggerLevels = loggerLevels;
    }

    /**
     * Retrieves the corresponding HaItem object based on the provided item.
     * 
     * @param item - The item to be converted into an HaItem object.
     * @returns The HaItem object representing the provided item.
     */
    public getItemObject(item: any): IHaItem {
        // BUG This breaks when Home Assistant is restarted due to trying to get events during that restart period - maybe fixed now
        // BUG This is NOT FIXED
        // BUG Actually it may be fixed now
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
                return new (HaItemFactory._itemClasses.get('nodedaemon'))(item, logLevel)
            }
            else if (HaItemFactory._itemClasses.has(itemType)) {
                return new (HaItemFactory._itemClasses.get(itemType))(item, logLevel);
            }
            else {
                return new (HaItemFactory._itemClasses.get('unknown'))(item , logLevel);
            }
        }
        catch (err) {
            logger.error(`This should not happen: ${err.message}`);
        }
    }

    /**
     * Retrieves a map of item objects.
     * @returns A promise that resolves to a Map containing item objects.
     */
    private static async _getItemObjects(): Promise<Map<string, IHaItemConstructor>> {
        return new Promise<Map<string, IHaItemConstructor>>(async (resolve, reject) => {
            const filetype = process.versions.bun? '.ts' : '.js';
            try {
                const dirEnts = await fs.readdir(__dirname, { withFileTypes: true });
                const files: [string, IHaItemConstructor][] = await Promise.all(dirEnts
                    .filter((dirent) => dirent.name.startsWith('haitem') && dirent.name.endsWith(filetype))
                    .map(async (dirent: any) => {
                        return [ dirent.name.split('.')[0].substring(6), (await import(path.join('../haitems/', dirent.name))).default ];
                    }
                ));
                resolve(new Map<string, IHaItemConstructor>(files));
            }
            catch(err) {
                reject(err);
            }
        });
    }
}
