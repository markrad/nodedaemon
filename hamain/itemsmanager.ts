"use strict";

import { IHaItem } from '../haitems/haparentitem';

export class ItemsManager {
    private _items: Map<string, IHaItem>;
    // private _items: any;
    public constructor() {
        this._items = new Map();
    }

    public addItem(item: IHaItem): void {
        this.items.set(item.entityId, item);
    }

    public deleteItem(entityId: string): void {
        this.items.delete(entityId);
    }

    public get items(): Map<string, IHaItem> {
        return this._items;
    }

    public getItem(entityId: string): IHaItem {
        return this.items.get(entityId);
    }

    public getItemsAsArray(sortFunction?: { (l: any, r: any): number }): Array<IHaItem> {
            return typeof(sortFunction) == 'function'
                ? [ ...this.items.values() ].sort(sortFunction)
                : [ ...this.items.values() ];
    }

    public getItemByName(name?: string, useRegEx?: boolean): Array<IHaItem> {
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

    public getItemByType(type?: string, useRegEx?: boolean): Array<IHaItem> {
        let re: RegExp = !type
            ? null
            : useRegEx
            ? new RegExp(type)
            : new RegExp(`^${type}$`);
        return this.getItemsAsArray()
            .filter(item => re? re.test(item.type) : true)
            .sort((l, r) => l.type < r.type ? -1 : l.type > r.type ? 1 : l.name < r.name ? -1 : l.name > r.name ? 1 : 0);
    }

    public getItemByFriendly(friendly?: string, useRegEx?: boolean): Array<IHaItem> {
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