var log4js = require('log4js');

const CATEGORY = 'HaMain';
var logger = log4js.getLogger(CATEGORY);

if (process.env.HAMAIN_LOGGING) {
    logger.level = process.env.HAMAIN_LOGGING;
}

class ItemsManager {
    constructor() {
        this._items = {};
    }

    addItem(item) {
        this.items[item.entityId] = item;
    }

    deleteItem(entityId) {
        delete this.items[entityId];
    }

    get items() {
        return this._items;
    }

    getItem(entityId) {
        return this._items[entityId];
    }

    getItemsAsArray(sortFunction) {
        return typeof(sortFunction) == 'function'
            ? Object.values(this.items).sort(sortFunction)
            : Object.values(this.items);
    }

    getItemByName(name, useRegEx) {
        let re = !name
            ? null
            : useRegEx
            ? new RegExp(name)
            : new RegExp(`^${name}$`);
        return this.getItemsAsArray()
            .filter(item =>  re? re.test(item.name) : true)
            .sort((l, r) => l.name < r.name ? -1 : l.name > r.name ? 1 : 0);
    }

    getItemByType(type, useRegEx) {
        let re = !type
            ? null
            : useRegEx
            ? new RegExp(type)
            : new RegExp(`^${type}$`);
        return this.getItemsAsArray()
            .filter(item => re? re.test(item.type) : true)
            .sort((l, r) => l.type < r.type ? -1 : l.type > r.type ? 1 : l.name < r.name ? -1 : l.name > r.name ? 1 : 0);
    }

    getItemByFriendly(friendly, useRegEx) {
        let re = !friendly
            ? null
            : useRegEx
            ? new RegExp(friendly)
            : new RegExp(`^${friendly}$`);
        return this.getItemsAsArray()
            .filter(item => re? re.test(item.attributes.friendly_name) : true)
            .sort((l, r) => l.attributes.friendly_name < r.attributes.friendly_name ? -1 : l.attributes.friendly_name > r.attributes.friendly_name ? 1 : 0);
    }
}

module.exports = ItemsManager;