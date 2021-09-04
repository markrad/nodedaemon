import { HaParentItem, IHaItemEditable, ServicePromise } from './haparentitem.js';
import { State } from '../hamain/index.js';

export abstract class HaGenericUpdateableItem extends HaParentItem implements IHaItemEditable {
    public constructor(item: State) {
        super(item);
    }

    public abstract updateState(newState: string | boolean | number): Promise<ServicePromise>;

    public get isEditable(): boolean {
        return true;
    }
}

