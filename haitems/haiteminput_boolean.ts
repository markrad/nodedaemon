import { State } from '../hamain/State'
import { HaGenericSwitchItem } from './hagenericswitchitem';
import { ServicePromise } from './haparentitem';

class HaItemInputBoolean extends HaGenericSwitchItem {
    public constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    public async updateState(newState: string | number | boolean): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }
}

module.exports = HaItemInputBoolean;