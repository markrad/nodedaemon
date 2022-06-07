import { State } from '../hamain/state'
import { ActionAndNewState, HaParentItem, ServicePromise } from './haparentitem';

class HaItemInputNumber extends HaParentItem {
    public constructor(item: State) {
        super(item);
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

module.exports = HaItemInputNumber;