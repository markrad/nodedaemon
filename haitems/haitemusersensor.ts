import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, ServicePromise } from './haparentitem';

export default class HaItemUserSensor extends HaGenericUpdateableItem {
    public constructor(item: State) {
        super(item);
    }

    public async updateState(newState: string | boolean | number, forceUpdate: boolean): Promise<ServicePromise> {
        return new Promise<ServicePromise>((resolve, _reject) => {
            let result = this.updateState(newState, forceUpdate);
            resolve(result);
        });
    }

    protected _getActionAndExpectedNewState(newState: string | boolean | number): ActionAndNewState { 
        let action = 'set';
        let expectedNewState: string = newState.toString();

        return { action: action, expectedNewState: expectedNewState };
    }
}
