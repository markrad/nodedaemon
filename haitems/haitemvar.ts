import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, ServicePromise } from './haparentitem';

class HaItemVar extends HaGenericUpdateableItem {
    public constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise<ServicePromise>((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState as string);
            var myResolve = (ret: ServicePromise) => {
                if (ret.message == 'success') {
                    // Call var.update to update icons etc.
                    this._callService(this.type, 'update', { entity_id: this.entityId });
                    this.logger.debug(`Set var ${this.entityId} to ${newState}`)
                }
                resolve({ message: ret.message, err: ret.err });
            }

            this._callServicePromise(myResolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    protected _getActionAndExpectedNewState(newState: string): ActionAndNewState { 
        let action = 'set';
        let expectedNewState = newState.toString();

        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemVar;