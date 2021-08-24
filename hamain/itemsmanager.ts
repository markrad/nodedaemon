"use strict";

import { getLogger, Logger } from 'log4js';
import { IHaItem } from '../haitems/haparentitem';

const CATEGORY: string = 'HaMain';
var logger: Logger = getLogger(CATEGORY);

if (process.env.HAMAIN_LOGGING) {
    logger.level = process.env.HAMAIN_LOGGING;
}

export class ItemsManager {
    private _items: Map<string, IHaItem>;
    // private _items: any;
    constructor() {
        this._items = new Map();
    }

    addItem(item: IHaItem): void {
        this.items.set(item.entityId, item);
    }

    deleteItem(entityId: string): void {
        this.items.delete(entityId);
    }

    get items(): Map<string, IHaItem> {
        return this._items;
    }

    getItem(entityId: string): IHaItem {
        return this.items.get(entityId);
    }

    getItemsAsArray(sortFunction?: { (l: any, r: any): number }): Array<IHaItem> {
            return typeof(sortFunction) == 'function'
                ? [ ...this.items.values() ].sort(sortFunction)
                : [ ...this.items.values() ];
    }

    getItemByName(name?: string, useRegEx?: boolean): Array<IHaItem> {
        let re: RegExp = !name
            ? null
            : useRegEx
            ? new RegExp(name)
            : new RegExp(`^${name}$`);
        return this.getItemsAsArray()
            .filter(item =>  re? re.test(item.entityId) : true)
            .sort((l, r) => l.entityId.localeCompare(r.entityId));
            // .sort((l, r) => l.entityId < r.entityId ? -1 : l.entityId > r.entityId ? 1 : 0);
    }

    getItemByType(type?: string, useRegEx?: boolean): Array<IHaItem> {
        let re: RegExp = !type
            ? null
            : useRegEx
            ? new RegExp(type)
            : new RegExp(`^${type}$`);
        return this.getItemsAsArray()
            .filter(item => re? re.test(item.type) : true)
            .sort((l, r) => l.type < r.type ? -1 : l.type > r.type ? 1 : l.name < r.name ? -1 : l.name > r.name ? 1 : 0);
    }

    getItemByFriendly(friendly?: string, useRegEx?: boolean): Array<IHaItem> {
        let re: RegExp = !friendly
            ? null
            : useRegEx
            ? new RegExp(friendly)
            : new RegExp(`^${friendly}$`);
        return this.getItemsAsArray()
            .filter(item => re? re.test(item.attributes.friendly_name) : true)
            .sort((l, r) => l.attributes.friendly_name < r.attributes.friendly_name ? -1 : l.attributes.friendly_name > r.attributes.friendly_name ? 1 : 0);
    }
}
