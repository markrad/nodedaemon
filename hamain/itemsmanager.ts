"use strict";

import { IHaItem } from '../haitems/ihaitem';

export class ItemsManager {
    private _items: Map<string, IHaItem>;
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

    public checkItemIs(type: any, obj: Object): boolean {
        return !!(type?.prototype?.isPrototypeOf(obj));
    }

    public convertItemTo(type: any, obj: Object): IHaItem {
        return this.checkItemIs(type, obj)? obj as typeof type : null;
    }

    public getItemAs<T>(type: any, entityId: string, throwOnFailure: boolean = false): T {
        let obj: IHaItem = this.getItem(entityId);

        if (obj == null) {
            if (throwOnFailure) throw new Error(`Failed to find item ${entityId}`);
            return null;
        }

        if (!this.checkItemIs(type, obj)) {
            if (throwOnFailure) throw new Error(`Failed to coerce item ${entityId} to ${type}`);
            return null;
        }

        return obj as unknown as T;
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
            .filter(item =>  re? re.test(item.name) : true)
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
