import { State } from '../hamain/index.js';
import { HaGenericSwitchItem } from './hagenericswitchitem.js';
import { ServicePromise } from './haparentitem.js';

class HaItemGroup extends HaGenericSwitchItem {
    children: any;
    constructor(item: State) {
        super(item);
        this.children = item.attributes.entity_id;
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState: string | number | boolean): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, 'homeassistant', action, { entity_id: this.entityId, value: expectedNewState });
        });
    }
}

module.exports = HaItemGroup;