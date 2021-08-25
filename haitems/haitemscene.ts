import { State } from '../hamain/index.js';
import { HaParentItem, ServicePromise } from './haparentitem.js';

class HaItemScene extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }

    public async activate(): Promise<ServicePromise> {
        return await this.updateState('turn_on');
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }
}

module.exports = HaItemScene;