import { State } from '../hamain/state'
import { ActionAndNewState, ServicePromise } from './haparentitem';
import { HaGenericUpdateableItem } from './hagenericupdatableitem';

export default class HaItemInputDateTime extends HaGenericUpdateableItem {
    public constructor(item: State) {
        super(item);
    }

    public async updateState(newState: string): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            let { action, expectedNewState } = this._getActionAndExpectedNewState(newState);

            if (action == 'error') {
                let err: Error = new Error(`Bad value passed to updateState - ${newState}`);
                this.logger.error(`${err.message}`);
                resolve({ message: action, err: err });
            }
            else {
                this._callServicePromise(resolve, newState, expectedNewState, 'var', action, { entity_id: this.entityId, value: expectedNewState });
            }
        });
    }

    protected _getActionAndExpectedNewState(newState: string): ActionAndNewState { 
        let action: string = 'set';
        let m: Date = new Date(newState);
        let expectedNewState: string;

        if (isNaN(m.getDate())) {
            action = 'error';
        }
        else {
            expectedNewState = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}-${m.getDate().toString().padStart(2, '0')} ` +
            `${m.getHours().toString().padStart(2, '0')}:${m.getMinutes().toString().padStart(2, '0')}:${m.getSeconds().toString().padStart(2, '0')}}`
        }
        return { action: action, expectedNewState: expectedNewState };
    }
}
