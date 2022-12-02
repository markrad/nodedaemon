import { IHaItem } from './ihaitem';
import { ServicePromise } from './haparentitem';

export interface IHaItemFixed extends IHaItem {
    get isEditable(): boolean;
    updateState(newState: string | boolean | number, forceUpdate: boolean): Promise<ServicePromise>;
}
