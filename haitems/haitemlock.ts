import { State } from '../hamain/index.js';
import { ActionAndNewState, HaParentItem, ServicePromise } from './haparentitem.js';

class HaItemLock extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    public async lock(): Promise<ServicePromise> {
        return await this.updateState('lock');
    }

    public async unlock(): Promise<ServicePromise> {
        return this.updateState('unlock');
    }

    public get isLocked(): boolean {
        return this.state == 'locked';
    }

    public get isUnlocked(): boolean {
        return this.state == 'unlocked';
    }

    public async updateState(newState: string | number | boolean): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }

    protected _getActionAndExpectedNewState(newState: string | number | boolean): ActionAndNewState { 
        let action = '';
        switch (typeof newState) {
            case 'boolean':
                action = newState? 'lock' : 'unlock';
                break;
            case 'number':
                action = newState == 0? 'unlock' : 'lock';
                break;
            case 'string':
                let work = newState.toLowerCase();
                action = work == 'lock'
                    ? 'lock'
                    : work == 'unlock'
                    ? 'unlock'
                    : work == 'turn_on'
                    ? 'lock'
                    : work == 'turn_off'
                    ? 'unlock'
                    : work == 'on'
                    ? 'lock'
                    : work == 'off'
                    ? 'unlock'
                    : 'error';
                break;
            default:
                action = 'error';
        }

        let expectedNewState = action == 'lock'
            ? 'locked'
            : action == 'unlock'
            ? 'unlocked'
            : 'error';
        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemLock;