import { State } from '../hamain/index.js';
import { HaGenericUpdateableItem } from './hagenericupdatableitem.js';
import { HaParentItem, ServicePromise } from './haparentitem.js';

class HaItemVar extends HaGenericUpdateableItem {
    constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise<ServicePromise>((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState as string);
            var myResolve = (ret: ServicePromise) => {
                if (ret.message == 'success') {
                    // Call var.update to update icons etc.
                    this.callService(this.type, 'update', { entity_id: this.entityId });
                }
                resolve({ message: ret.message, err: ret.err });
            }

            this._callServicePromise(myResolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    _getActionAndExpectedSNewtate(newState: string): { action: typeof action, expectedNewState: typeof expectedNewState } {
        let action = 'set';
        let expectedNewState = newState.toString();

        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemVar;