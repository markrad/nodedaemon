const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaGenericSwitchItem extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
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

module.exports = HaGenericSwitchItem;