// import { resolve } from 'path/posix';
import { State } from '../hamain/index.js';
import { HaGenericUpdateableItem } from './hagenericupdatableitem.js';
import { IHaItemEditable, ServicePromise } from './haparentitem.js';

enum SUPPORT {
    SUPPORT_BRIGHTNESS = 1,
    SUPPORT_COLOR_TEMP = 2,
    SUPPORT_EFFECT = 4,
    SUPPORT_FLASH = 8,
    SUPPORT_COLOR = 16,
    SUPPORT_TRANSITION = 32,
    SUPPORT_WHITE_VALUE = 128,
}

type ActionAndNewState = {
    action: string,
    expectedNewState: string
}

export abstract class HaGenericSwitchItem extends HaGenericUpdateableItem implements IHaItemEditable {
    _moment: number;
    _support: SUPPORT;
    _timer: any;
    constructor(item: State) {
        super(item);
        this._moment = 0;
        this._timer = null;

        if (this.isBrightnessSupported) this.updateBrightness = this._updateBrightness;

        this.on('new_state', (that, _oldstate) => {
            let brightnessMsg = `${that.isOn && that.isBrightnessSupported? 'Brightness: ' + that.brightness : ''}`;
            let tempMsg = `${that.isOn && that.isTemperatureSupported? 'Temperature: ' + that.temperature : ''}`;
            this.logger.debug(`Received new state: ${that.state} ${brightnessMsg} ${tempMsg}`);
            if (this._moment != 0) {
                this.logger.debug('Cancelling off timer');
                clearTimeout(this._timer);
                this._timer = null;
                this._moment = 0;
            }
        });
    }

    async turnOn(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, _reject) => {
            let ret: ServicePromise = null;
            ret = await this.updateState('on');
            resolve(ret);
        });
    }

    async turnOff(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, _reject) => {
            let ret: ServicePromise = null;
            ret = await this.updateState('off');
            resolve(ret);
        });
    }

    async turnOffAt(moment: number): Promise<void> {
        return new Promise<void>(async (resolve, _reject) => {
            if (this.isOff || (this.isOn && this._moment != 0 && this._moment < moment)) {
                if (this.isOff) {
                    await this.turnOn();
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
    
            resolve();
        });
    }

    async toggle(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, _reject) => {
            let ret: ServicePromise = null;
            ret = await this.updateState('toggle');
            resolve(ret);
        });
    }

    get isOn(): boolean {
        return this.state == 'on';
    }

    get isOff(): boolean {
        return this.state == 'off';
    }

    get isTimerRunning(): boolean {
        return this._moment != 0;
    }

    get timeBeforeOff(): number {
        return this._moment == 0
                ? 0
                : this._moment - Date.now();
    }

    get isBrightnessSupported(): boolean {
        return !!((this.attributes?.supported_features ?? 0) & SUPPORT.SUPPORT_BRIGHTNESS);
    }

    get isTemperatureSupported(): boolean {
        return !!((this.attributes?.supported_features ?? 0) & SUPPORT.SUPPORT_COLOR_TEMP);
    }

    get brightness(): number {
        return this.isBrightnessSupported? this.attributes.brightness : NaN
    }

    get temperature(): number {
        return this.isTemperatureSupported? this.attributes.color_temp : NaN
    }

    get isSwitch(): boolean {
        return true;
    }

    async updateBrightness(_newValue: number | string) { 
        return new Promise(resolve => resolve(new Error('Brightness is not supported')));
    }

    async updateTemperature(_newValue: number | string) {
        return new Promise(resolve => resolve(new Error('Temperature is not supported')));
    }

    _updateBrightness(newValue: number | string) {
        return new Promise((resolve, _reject) => {
            var level = Number(newValue);
            if (level == NaN) {
                resolve(new Error('Brightness value must be a number between 1 and 254'));
            }
            else {
                if (level < 0) level = 0;
                else if (level > 254) level = 254;
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, brightness: level });
            }
        });
    }

    async _updateTemperature(newValue: number | string): Promise<any> {
        return new Promise<any>((resolve, _reject) => {
            var temp = Number(newValue);
            if (temp == NaN) {
                resolve(new Error('Color temperature must be numeric'));
            }
            else {
                if (temp < this.attributes.min_mireds) temp = this.attributes.min_mireds;
                else if (temp > this.attributes.max_mireds) temp = this.attributes.max_mireds;
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, color_temp: temp });
            }
        });
    }

    async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }

    // TODO make a type of this
    _getActionAndExpectedSNewtate(newState: boolean | number | string): ActionAndNewState {
        let action: string = '';
        switch (typeof newState) {
            case 'boolean':
                action = newState? 'turn_on' : 'turn_off';
                break;
            case 'number':
                action = newState == 0? 'turn_off' : 'turn_on';
                break;
            case 'string':
                let work: string = newState.toLowerCase();
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

        let expectedNewState: string = action == 'turn_on'
            ? 'on'
            : action == 'turn_off'
            ? 'off'
            : action == 'toggle'
            ? ['off', 'on'][(this.isOff? 0 : 1)]
            : 'error';
        return { action: action, expectedNewState: expectedNewState };
    }
}
