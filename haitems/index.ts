import fs from 'fs';
import log4js from 'log4js';
import { HaInterface } from '../hainterface';
import { HaParentItem, IHaItem } from './haparentitem';
//var config = require('../config.json').main;

const CATEGORY: string = 'HaItemFactory';
var logger: any = log4js.getLogger(CATEGORY);
logger.level = 'info';

export class HaItemFactory {
    _itemClasses: any;

    constructor() {
        this._itemClasses = {};
        this._getItemObjects()
            .then(() => logger.debug('Objects acquired'))
            .catch((err) => {
                logger.error('Unable to walk directory of haitems');
                throw (err);
            });
    }

    getItemObject(item: any, transport: HaInterface): IHaItem {
        let itemType: string = item.entity_id.split('.')[0];
        if (itemType in this._itemClasses) {
            return new this._itemClasses[itemType](item, transport);
        }
        else {
            return new this._itemClasses['unknown'](item, transport);
        }
    }

    async _getItemObjects(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const dir = await fs.promises.opendir(__dirname);

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
