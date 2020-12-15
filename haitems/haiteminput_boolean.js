const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemInputBoolean extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState) {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, 'input_boolean', action, { entity_id: this.entityId });
        });
    }

    turnOn() {
        return this.updateState('on');
    }

    turnOff() {
        return this.updateState('off');
    }

    toggle() {
        return this.updateState('toggle');
    }

    get isOn() {
        return this.state == 'on';
    }

    get isOff() {
        return this.state == 'off';
    }

    _getActionAndExpectedSNewtate(newState) {
        let action = '';
        switch (typeof newState) {
            case 'boolean':
                action = newState? 'turn_on' : 'turn_off';
                break;
            case 'number':
                action = newState == 0? 'turn_off' : 'turn_on';
                break;
            case 'string':
                let work = newState.toLowerCase();
                action = work == 'toggle'
                    ? 'toggle'
                    : work == 'on'
                    ? 'turn_on'
                    : work == 'turn_on'
                    ? 'turn_on'
                    : work == 'off'
                    ? 'turn_off'
                    : work == 'turn_off'
                    ? 'turn_off'
                    : 'error';
                break;
            default:
                action = 'error';
        }

        let expectedNewState = action == 'turn_on'
            ? 'on'
            : action == 'turn_off'
            ? 'off'
            : action == 'toggle'
            ? ['off', 'on'][(this.isOff + 0)]
            : 'error';
        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemInputBoolean;