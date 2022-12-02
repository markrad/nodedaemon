import { State } from '../hamain/state'
import { ServicePromise } from './haparentitem';
import { HaGenericButtonItem } from './hagenericbuttonitem';


// TODO Validate this logic
export default class HaItemScene extends HaGenericButtonItem {
    public constructor(item: State) {
        super(item);
    }

    public async activate(): Promise<ServicePromise> {
        return await this.updateState('turn_on');
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }
}
