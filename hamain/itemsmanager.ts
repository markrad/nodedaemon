"use strict";

import { IHaItem } from '../haitems/ihaitem';

/**
 * Implements a dictionary for storing the state of all known entities in Home Assistant.
 */
export class ItemsManager {
    private _items: Map<string, IHaItem>;
    /**
     * Constructs a new instance of the ItemsManager class.
     */
    public constructor() {
        this._items = new Map();
    }

    /**
     * Adds an item to the items manager.
     * 
     * @param item - The item to be added.
     */
    public addItem(item: IHaItem): void {
        this.items.set(item.entityId, item);
    }

    /**
     * Deletes an item from the items manager.
     * 
     * @param entityId - The ID of the entity to delete.
     * @returns void
     */
    public deleteItem(entityId: string): void {
        this.items.delete(entityId);
    }

    /**
     * Gets the items stored in the items manager.
     *
     * @returns A map of items, where the key is a string and the value is an `IHaItem` object.
     */
    public get items(): Map<string, IHaItem> {
        return this._items;
    }

    /**
     * Retrieves an item from the items manager based on the provided entity ID.
     * @param entityId - The ID of the entity to retrieve.
     * @returns The item associated with the provided entity ID, or undefined if no item is found.
     */
    public getItem(entityId: string): IHaItem {
        return this.items.get(entityId);
    }

    /**
     * Checks if the given object is an instance of the specified type.
     * 
     * @param type - The type to check against.
     * @param obj - The object to check.
     * @returns Returns `true` if the object is an instance of the type, `false` otherwise.
     */
    public checkItemIs(type: any, obj: Object): boolean {
        return !!(type?.prototype?.isPrototypeOf(obj));
    }

    /**
     * Converts an object to a specific type of item.
     * 
     * @param type - The type of item to convert to.
     * @param obj - The object to convert.
     * @returns The converted item if the object is of the specified type, otherwise null.
     */
    public convertItemTo(type: any, obj: Object): IHaItem {
        return this.checkItemIs(type, obj)? obj as typeof type : null;
    }

    /**
     * Retrieves an item as a specific type.
     * 
     * @template T - The type of the item to retrieve.
     * @param entityId - The ID of the entity.
     * @param ctor - The constructor function of the item type.
     * @param throwOnFailure - Indicates whether to throw an error if the item is not found or cannot be cast to the specified type. Default is false.
     * @returns The item as the specified type, or null if not found and throwOnFailure is false.
     * @throws Error if the item is not found or cannot be cast to the specified type and throwOnFailure is true.
     */
    public getItemAsEx<T extends IHaItem>(entityId: string, ctor: { new (...args: any[]): T }, throwOnFailure: boolean = false): T {
        let instance: IHaItem = this.getItem(entityId);
        try {
            if (instance && instance instanceof ctor) return instance as T;
        }
        catch (_err) {
            _err;
        }
        if (throwOnFailure) throw new Error(`Entity ${entityId} not found or cannot be cast to ${ctor.name}`);
        return null;
    }

    /**
     * Retrieves an item of type T from the items manager.
     * 
     * @template T - The type of the item to retrieve.
     * @param type - The type of the item to retrieve.
     * @param entityId - The ID of the item to retrieve.
     * @param throwOnFailure - Indicates whether to throw an error if the item is not found or cannot be coerced to the specified type. Default is false.
     * @returns The retrieved item of type T, or null if the item is not found or cannot be coerced to the specified type.
     * @throws Error if the item is not found and throwOnFailure is true, or if the item cannot be coerced to the specified type and throwOnFailure is true.
     */
    public getItemAs<T extends IHaItem>(type: unknown, entityId: string, throwOnFailure: boolean = false): T {

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

    /**
     * Retrieves the items stored in the items manager as an array.
     * 
     * @param sortFunction - An optional function used to sort the items in the array.
     * @returns An array of IHaItem objects.
     */
    public getItemsAsArray(sortFunction?: { (l: any, r: any): number }): Array<IHaItem> {
            return typeof(sortFunction) == 'function'
                ? [ ...this.items.values() ].sort(sortFunction)
                : [ ...this.items.values() ];
    }

    /**
     * Retrieves an array of items based on the provided entity ID.
     * 
     * @param name - The name of the entity ID to search for. Optional.
     * @param useRegEx - Specifies whether to use regular expressions for matching. Optional.
     * @returns An array of items that match the provided entity ID.
     */
    public getItemByEntityId(name?: string, useRegEx?: boolean): Array<IHaItem> {
        let re: RegExp = !name
            ? null
            : useRegEx
            ? new RegExp(name)
            : new RegExp(`^${name}$`);
        return this.getItemsAsArray()
            .filter(item =>  re? re.test(item.entityId) : true)
            .sort((l, r) => l.entityId.localeCompare(r.entityId));
    }

    /**
     * Retrieves an array of items by their name.
     * 
     * @param name - The name of the items to retrieve. If not provided, all items will be returned.
     * @param useRegEx - Specifies whether to use regular expressions for matching the item names.
     * @returns An array of items that match the specified name.
     */
    public getItemByName(name?: string, useRegEx?: boolean): Array<IHaItem> {
        let re: RegExp = !name
            ? null
            : useRegEx
            ? new RegExp(name)
            : new RegExp(`^${name}$`);
        return this.getItemsAsArray()
            .filter(item =>  re? re.test(item.name) : true)
            .sort((l, r) => l.entityId.localeCompare(r.entityId));
    }

    /**
     * Retrieves an array of items based on the specified type.
     * 
     * @param type - The type of items to retrieve. If not provided, all items will be returned.
     * @param useRegEx - Specifies whether to use regular expressions for matching the type. Default is false.
     * @returns An array of items that match the specified type.
     */
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

    /**
     * Retrieves an array of items based on their friendly name.
     * 
     * @param friendly - The friendly name of the items to retrieve.
     * @param useRegEx - Indicates whether to use regular expressions for matching the friendly name.
     * @returns An array of items that match the given friendly name.
     */
    public getItemByFriendly(friendly?: string, useRegEx?: boolean): Array<IHaItem> {
        let re: RegExp = !friendly
            ? null
            : useRegEx
            ? new RegExp(friendly)
            : new RegExp(`^${friendly}$`);
        return this.getItemsAsArray()
            .filter(item => re? re.test(item.friendlyName) : true)
            .sort((l, r) => l.friendlyName < r.friendlyName ? -1 : l.friendlyName > r.friendlyName ? 1 : 0);
    }
}
