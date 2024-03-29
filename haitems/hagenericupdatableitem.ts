import { HaParentItem, ServicePromise } from './haparentitem';
import { IHaItemEditable } from './ihaitemeditable';
import { State } from '../hamain/state'
import { Level } from 'log4js';

export class HaGenericUpdateableItem extends HaParentItem implements IHaItemEditable {
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
    }

    public async updateState(_newState: string | boolean | number, _forceUpdate: boolean): Promise<ServicePromise>{
        throw new Error('This function should be overridden');
    };

    public get isEditable(): boolean {
        return true;
    }
}

