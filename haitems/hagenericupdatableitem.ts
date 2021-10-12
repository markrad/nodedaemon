import { HaParentItem, IHaItemEditable, ServicePromise } from './haparentitem';
import { State } from '../hamain/state'

export abstract class HaGenericUpdateableItem extends HaParentItem implements IHaItemEditable {
    public constructor(item: State) {
        super(item);
    }

    public abstract updateState(newState: string | boolean | number): Promise<ServicePromise>;

    public get isEditable(): boolean {
        return true;
    }
}

