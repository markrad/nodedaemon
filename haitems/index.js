const fs = require('fs');
var log4js = require('log4js');
//var config = require('../config.json').main;

const CATEGORY = 'HaItemFactory';
var logger = log4js.getLogger(CATEGORY);
logger.level = 'info';

class HaItemFactory {
    constructor() {
        this.itemClasses = {};
        this._getItemObjects()
            .then(() => logger.debug('Objects acquired'))
            .catch((err) => {
                logger.error('Unable to walk directory of haitems');
                throw (err);
            });
    }

    getItemObject(item, transport) {
        let itemType = item.entity_id.split('.')[0];
        if (itemType in this.itemClasses) {
            return new this.itemClasses[itemType](item, transport);
        }
        else {
            return new this.itemClasses['unknown'](item, transport);
        }
    }

    async _getItemObjects() {
        let ret = new Promise(async (resolve, reject) => {
            try {
                const dir = await fs.promises.opendir(__dirname);

                for await (const dirent of dir) {
                    if (dirent.name.startsWith('haitem') && dirent.name.endsWith('.js')) {
                        let itemType = dirent.name.split('.')[0].substr(6);
                        this.itemClasses[itemType] = require('./' + dirent.name);
                    }
                }

                resolve();
            }
            catch(err) {
                reject(err);
            }
        });

        return ret;
    }
}

module.exports = HaItemFactory;