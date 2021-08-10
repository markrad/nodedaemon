import { HaGenericSwitchItem } from './hagenericswitchitem.js';

class HaItemInputBoolean extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState): Promise<void> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }
}

module.exports = HaItemInputBoolean;