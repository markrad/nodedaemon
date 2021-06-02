const { resolve } = require('require-reload');

const HaParentItem = require('./haparentitem.js');

class HaGenericSwitchItem extends HaParentItem {
    constructor(item) {
        super(item);
        this.moment = 0;
        this.timer = null;
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
            if (this.moment != 0) {
                this.logger.debug('Cancelling off timer');
                clearTimeout(this.timer);
                this.timer = null;
                this.moment = 0;
            }
        });
    }

    turnOn() {
        return this.updateState('on');
    }

    turnOff() {
        return this.updateState('off');
    }

    async turnOffAt(moment) {
        if (this.isOff || (this.isOn && this.moment != 0 && this.moment < moment)) {
            if (this.isOff) {
                await this.turnOn();
            }
            if (this.moment > 0) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            this.moment = moment;
            this.timer = setTimeout(() => {
                this.turnOff();
                this.moment = 0;
                this.timer = null;
            }, this.moment - Date.now());
            this.logger.debug(`Turning off at ${new Date(this.moment)}`);
        }
        else {
            this.logger.debug(`turnOffAt ignored: state=${this.state};moment=${this.moment};requested=${moment}`);
        }
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

    get isTimerRunning() {
        return this.moment != 0;
    }

    get timeBeforeOff() {
        return this.moment == 0
                ? 0
                : moment - Date.now();
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

    get isSwitch() {
        return true;
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