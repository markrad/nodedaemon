import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, ServicePromise } from './haparentitem';

export default class HaItemInputNumber extends HaGenericUpdateableItem {
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
    }

    public async updateState(newState: string | number | boolean): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    public async incrementState() {
        return this.updateState(Number(this.state) + 1);
    }

    public async decrementState() {
        return this.updateState(Number(this.state - 1));
    }

    public get state(): number {
        return Number(super.state);
    }

    protected _getActionAndExpectedNewState(newState: string | number | boolean): ActionAndNewState { 
        let action = 'set_value';
        let expectedNewState = null;

        if (typeof newState == 'number' && isNaN(newState)) {
            action = 'error';
        }
        else {
            expectedNewState = newState.toString();

            if (Number(expectedNewState) > Number(this.attributes.max)) {
                expectedNewState = this.attributes.max;
            }
            else if (Number(expectedNewState) < Number(this.attributes.min)) {
                expectedNewState = this.attributes.min;
            }
        }

        return { action: action, expectedNewState: expectedNewState };
    }
}
