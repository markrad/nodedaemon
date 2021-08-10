import { HaParentItem } from './haparentitem.js';

class HaItemVar extends HaParentItem {
    constructor(item) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState): Promise<any> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            var myResolve = (msg, err) => {
                if (msg == 'success') {
                    // Call var.update to update icons etc.
                    this.callService(this.type, 'update', { entity_id: this.entityId });
                }
                resolve({ message: msg, error: err });
            }

            this._callServicePromise(myResolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    _getActionAndExpectedSNewtate(newState) {
        let action = 'set';
        let expectedNewState = newState.toString();

        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemVar;