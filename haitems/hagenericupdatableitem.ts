import { HaParentItem, IHaItemEditable, ServicePromise } from './haparentitem';
import { State } from '../hamain/state'

export class HaGenericUpdateableItem extends HaParentItem implements IHaItemEditable {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }

    public updateState(_newState: string | boolean | number): Promise<ServicePromise>{
        throw new Error('This function should be overridden');
    };

    public get isEditable(): boolean {
        return true;
    }
}

