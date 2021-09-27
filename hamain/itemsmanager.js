"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsManager = void 0;
class ItemsManager {
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
            ? [...this.items.values()].sort(sortFunction)
            : [...this.items.values()];
    }
    getItemByName(name, useRegEx) {
        let re = !name
            ? null
            : useRegEx
                ? new RegExp(name)
                : new RegExp(`^${name}$`);
        return this.getItemsAsArray()
            .filter(item => re ? re.test(item.entityId) : true)
            .sort((l, r) => l.entityId.localeCompare(r.entityId));
        // .sort((l, r) => l.entityId < r.entityId ? -1 : l.entityId > r.entityId ? 1 : 0);
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