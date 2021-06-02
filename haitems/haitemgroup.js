const HaGenericSwitchItem = require('./hagenericswitchitem.js');

class HaItemGroup extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.children = item.attributes.entity_id;
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState) {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, 'homeassistant', action, { entity_id: this.entityId, value: expectedNewState });
        });
    }
}

module.exports = HaItemGroup;