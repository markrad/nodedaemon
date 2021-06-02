const HaParentItem = require('./haparentitem.js');

class HaItemLock extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    lock() {
        return this.updateState('lock');
    }

    unlock() {
        return this.updateState('unlock');
    }

    get isLocked() {
        return this.state == 'locked';
    }

    get isUnlocked() {
        return this.state == 'unlocked';
    }

    async updateState(newState) {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }

    _getActionAndExpectedSNewtate(newState) {
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