const log4js = require('log4js');
const { resolve } = require('require-reload');

const HaParentItem = require('./haparentitem.js');

class HaGenericSwitchItem extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this._SUPPORT_BRIGHTNESS = 1
        this._SUPPORT_COLOR_TEMP = 2
        this._SUPPORT_EFFECT = 4
        this._SUPPORT_FLASH = 8
        this._SUPPORT_COLOR = 16
        this._SUPPORT_TRANSITION = 32
        this._SUPPORT_WHITE_VALUE = 128

        if (this.isBrightnessSupported) this.updateBrightness = this._updateBrightness;

        this.on('new_state', (that, _oldstate) => {
            let brightnessMsg = `${that.isOn && that.isBrightnessSupported? 'Brightness: ' + that.brightness : ''}`;
            let tempMsg = `${that.isOn && that.isTemperatureSupported? 'Temperature: ' + that.temperature : ''}`;
            this.logger.debug(`Received new state: ${that.state} ${brightnessMsg} ${tempMsg}`);
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

    get isBrightnessSupported() {
        return !!((this.attributes?.supported_features ?? 0) & this._SUPPORT_BRIGHTNESS);
    }

    get isTemperatureSupported() {
        return !!((this.attributes?.supported_features ?? 0) & this._SUPPORT_COLOR_TEMP);
    }

    get brightness() {
        return this.isBrightnessSupported? this.attributes.brightness : NaN
    }

    get temperature() {
        return this.isTemperatureSupported? this.attributes.color_temp : NaN
    }

    async updateBrightness(_newValue) { 
        return new Promise(resolve => resolve(new Error('Brightness is not supported')));
    }

    async updateTemperature(_newValue) {
        return new Promise(resolve => resolve(new Error('Temperature is not supported')));
    }

    _updateBrightness(newValue) {
        return new Promise((resolve, _reject) => {
            var level = Number(newValue);
            if (level == NaN) {
                resolve('error', new Error('Brightness value must be a number between 1 and 254'));
            }
            else {
                if (level < 0) level = 0;
                else if (level > 254) level = 254;
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, brightness: level });
            }
        });
    }

    _updateTemperature(newValue) {
        return new Promise((reaolve, _reject) => {
            var temp = Number(newValue);
            if (temp == NaN) {
                resolve('error', new Error('Color temperature must be numeric'));
            }
            else {
                if (temp < this.attributes.min_mireds) temp = min_mireds;
                else if (temp > this.attributes.max_mireds) temp = max_mireds;
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, color_temp: temp });
            }
        });
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