"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsManager = void 0;
const log4js_1 = require("log4js");
const CATEGORY = 'HaMain';
var logger = log4js_1.getLogger(CATEGORY);
if (process.env.HAMAIN_LOGGING) {
    logger.level = process.env.HAMAIN_LOGGING;
}
class ItemsManager {
    // private _items: any;
    constructor() {
        this._items = new Map();
    }
    addItem(item) {
        this.items.set(item.entityId, item);
    }
    deleteItem(entityId) {
        this.items.delete(entityId);
    }
    get items() {
        return this._items;
    }
    getItem(entityId) {
        return this.items.get(entityId);
    }
    getItemsAsArray(sortFunction) {
        return typeof (sortFunction) == 'function'
            ? Array.from(this.items.values()).sort(sortFunction)
            : Object.values(this.items);
    }
    getItemByName(name, useRegEx) {
        let re = !name
            ? null
            : useRegEx
                ? new RegExp(name)
                : new RegExp(`^${name}$`);
        return this.getItemsAsArray()
            .filter(item => re ? re.test(item.name) : true)
            .sort((l, r) => l.name < r.name ? -1 : l.name > r.name ? 1 : 0);
    }
    getItemByType(type, useRegEx) {
        let re = !type
            ? null
            : useRegEx
                ? new RegExp(type)
                : new RegExp(`^${type}$`);
        return this.getItemsAsArray()
            .filter(item => re ? re.test(item.type) : true)
            .sort((l, r) => l.type < r.type ? -1 : l.type > r.type ? 1 : l.name < r.name ? -1 : l.name > r.name ? 1 : 0);
    }
    getItemByFriendly(friendly, useRegEx) {
        let re = !friendly
            ? null
            : useRegEx
                ? new RegExp(friendly)
                : new RegExp(`^${friendly}$`);
        return this.getItemsAsArray()
            .filter(item => re ? re.test(item.attributes.friendly_name) : true)
            .sort((l, r) => l.attributes.friendly_name < r.attributes.friendly_name ? -1 : l.attributes.friendly_name > r.attributes.friendly_name ? 1 : 0);
    }
}
exports.ItemsManager = ItemsManager;
//# sourceMappingURL=itemsmanager.js.map