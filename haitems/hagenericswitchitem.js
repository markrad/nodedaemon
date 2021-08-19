"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaGenericSwitchItem = void 0;
const require_reload_1 = require("require-reload");
const haparentitem_js_1 = require("./haparentitem.js");
var SUPPORT;
(function (SUPPORT) {
    SUPPORT[SUPPORT["SUPPORT_BRIGHTNESS"] = 1] = "SUPPORT_BRIGHTNESS";
    SUPPORT[SUPPORT["SUPPORT_COLOR_TEMP"] = 2] = "SUPPORT_COLOR_TEMP";
    SUPPORT[SUPPORT["SUPPORT_EFFECT"] = 4] = "SUPPORT_EFFECT";
    SUPPORT[SUPPORT["SUPPORT_FLASH"] = 8] = "SUPPORT_FLASH";
    SUPPORT[SUPPORT["SUPPORT_COLOR"] = 16] = "SUPPORT_COLOR";
    SUPPORT[SUPPORT["SUPPORT_TRANSITION"] = 32] = "SUPPORT_TRANSITION";
    SUPPORT[SUPPORT["SUPPORT_WHITE_VALUE"] = 128] = "SUPPORT_WHITE_VALUE";
})(SUPPORT || (SUPPORT = {}));
class HaGenericSwitchItem extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
        this._moment = 0;
        this._timer = null;
        // this._SUPPORT_BRIGHTNESS = 1
        // this._SUPPORT_COLOR_TEMP = 2
        // this._SUPPORT_EFFECT = 4
        // this._SUPPORT_FLASH = 8
        // this._SUPPORT_COLOR = 16
        // this._SUPPORT_TRANSITION = 32
        // this._SUPPORT_WHITE_VALUE = 128
        if (this.isBrightnessSupported)
            this.updateBrightness = this._updateBrightness;
        this.on('new_state', (that, _oldstate) => {
            let brightnessMsg = `${that.isOn && that.isBrightnessSupported ? 'Brightness: ' + that.brightness : ''}`;
            let tempMsg = `${that.isOn && that.isTemperatureSupported ? 'Temperature: ' + that.temperature : ''}`;
            this.logger.debug(`Received new state: ${that.state} ${brightnessMsg} ${tempMsg}`);
            if (this._moment != 0) {
                this.logger.debug('Cancelling off timer');
                clearTimeout(this._timer);
                this._timer = null;
                this._moment = 0;
            }
        });
    }
    turnOn() {
        return this.updateState('on');
    }
    turnOff() {
        return this.updateState('off');
    }
    turnOffAt(moment) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOff || (this.isOn && this._moment != 0 && this._moment < moment)) {
                if (this.isOff) {
                    yield this.turnOn();
                }
                if (this._moment > 0) {
                    clearTimeout(this._timer);
                    this._timer = null;
                }
                this._moment = moment;
                this._timer = setTimeout(() => {
                    this.turnOff();
                    this._moment = 0;
                    this._timer = null;
                }, this._moment - Date.now());
                this.logger.debug(`Turning off at ${new Date(this._moment)}`);
            }
            else {
                this.logger.debug(`turnOffAt ignored: state=${this.state};moment=${this._moment};requested=${moment}`);
            }
        });
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
        return this._moment != 0;
    }
    get timeBeforeOff() {
        return this._moment == 0
            ? 0
            : this._moment - Date.now();
    }
    get isBrightnessSupported() {
        var _a, _b;
        return !!(((_b = (_a = this.attributes) === null || _a === void 0 ? void 0 : _a.supported_features) !== null && _b !== void 0 ? _b : 0) & SUPPORT.SUPPORT_BRIGHTNESS);
    }
    get isTemperatureSupported() {
        var _a, _b;
        return !!(((_b = (_a = this.attributes) === null || _a === void 0 ? void 0 : _a.supported_features) !== null && _b !== void 0 ? _b : 0) & SUPPORT.SUPPORT_COLOR_TEMP);
    }
    get brightness() {
        return this.isBrightnessSupported ? this.attributes.brightness : NaN;
    }
    get temperature() {
        return this.isTemperatureSupported ? this.attributes.color_temp : NaN;
    }
    get isSwitch() {
        return true;
    }
    updateBrightness(_newValue) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => resolve(new Error('Brightness is not supported')));
        });
    }
    updateTemperature(_newValue) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => resolve(new Error('Temperature is not supported')));
        });
    }
    _updateBrightness(newValue) {
        return new Promise((resolve, _reject) => {
            var level = Number(newValue);
            if (level == NaN) {
                resolve(new Error('Brightness value must be a number between 1 and 254'));
            }
            else {
                if (level < 0)
                    level = 0;
                else if (level > 254)
                    level = 254;
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, brightness: level });
            }
        });
    }
    _updateTemperature(newValue) {
        return new Promise((reaolve, _reject) => {
            var temp = Number(newValue);
            if (temp == NaN) {
                require_reload_1.resolve('error', new Error('Color temperature must be numeric'));
            }
            else {
                if (temp < this.attributes.min_mireds)
                    temp = this.attributes.min_mireds;
                else if (temp > this.attributes.max_mireds)
                    temp = this.attributes.max_mireds;
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate('turn_on');
                this._callServicePromise(require_reload_1.resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, color_temp: temp });
            }
        });
    }
    updateState(newState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
                this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
            });
        });
    }
    _getActionAndExpectedSNewtate(newState) {
        let action = '';
        switch (typeof newState) {
            case 'boolean':
                action = newState ? 'turn_on' : 'turn_off';
                break;
            case 'number':
                action = newState == 0 ? 'turn_off' : 'turn_on';
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
                    ? ['off', 'on'][(this.isOff ? 0 : 1)]
                    : 'error';
        return { action: action, expectedNewState: expectedNewState };
    }
}
exports.HaGenericSwitchItem = HaGenericSwitchItem;
//# sourceMappingURL=hagenericswitchitem.js.map