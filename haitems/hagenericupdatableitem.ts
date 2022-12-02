import { HaParentItem, ServicePromise } from './haparentitem';
import { IHaItemEditable } from "./IHaItemEditable";
import { State } from '../hamain/state'

export class HaGenericUpdateableItem extends HaParentItem implements IHaItemEditable {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }

    public updateState(_newState: string | boolean | number, _forceUpdate: boolean): Promise<ServicePromise>{
        throw new Error('This function should be overridden');
    };

    public get isEditable(): boolean {
        return true;
    }
}

