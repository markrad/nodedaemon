import { State } from '../hamain/index.js';
import { ActionAndNewState, HaParentItem } from './haparentitem.js';

class HaItemInputDateTime extends HaParentItem {
    constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState: string): Promise<any> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);

            if (action == 'error') {
                let err: Error = new Error(`Bad value passed to updateState - ${newState}`);
                this.logger.error(`${err.message}`);
                resolve({ action: action, error: err });
            }
            else {
                this._callServicePromise(resolve, newState, expectedNewState, 'var', action, { entity_id: this.entityId, value: expectedNewState });
            }
        });
    }

    _getActionAndExpectedSNewtate(newState: string): ActionAndNewState { 
        let action: string = 'set';
        let m: Date = new Date(newState);
        let expectedNewState: string;

        if (isNaN(m.getDate())) {
            action = 'error';
        }
        else {
            expectedNewState = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}-${m.getDate().toString().padStart(2, '0')} ` +
            `${m.getHours().toString().padStart(2, '0')}:${m.getMinutes().toString().padStart(2, '0')}:${m.getSeconds().toString().padStart(2, '0')}}`
        }
        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemInputDateTime;