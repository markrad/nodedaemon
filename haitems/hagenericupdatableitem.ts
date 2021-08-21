import { HaParentItem, IHaItemEditable, ServicePromise } from './haparentitem.js';
import { State } from '../hamain/index.js';


export abstract class HaGenericUpdateableItem extends HaParentItem implements IHaItemEditable {
    constructor(item: State) {
        super(item);
    }

    abstract updateState(newState: string | boolean | number): Promise<ServicePromise>;

    get isEditable(): boolean {
        return true;
    }
}

