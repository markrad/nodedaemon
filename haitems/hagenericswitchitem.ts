import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, IHaItemEditable, ServicePromise } from './haparentitem';

export enum SUPPORT {
    SUPPORT_BRIGHTNESS = 1,
    SUPPORT_COLOR_TEMP = 2,
    SUPPORT_EFFECT = 4,
    SUPPORT_FLASH = 8,
    SUPPORT_COLOR = 16,
    SUPPORT_TRANSITION = 32,
    SUPPORT_WHITE_VALUE = 128,
}

export abstract class HaGenericSwitchItem extends HaGenericUpdateableItem implements IHaItemEditable {
    private _moment: number;
    private _support: SUPPORT;       
    private _timer: NodeJS.Timeout;
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
        this._moment = 0;
        this._timer = null;
        this._support = this.attributes?.supported_features ?? 0;

        if (this.isBrightnessSupported) this.updateBrightness = this._updateBrightness;
        if (this.isTemperatureSupported) this.updateTemperature = this._updateTemperature;

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

    public async turnOn(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, _reject) => {
            let ret: ServicePromise = null;
            ret = await this.updateState('on');
            resolve(ret);
        });
    }

    public async turnOff(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, _reject) => {
            let ret: ServicePromise = null;
            ret = await this.updateState('off');
            resolve(ret);
        });
    }

    public async turnOffAt(moment: number): Promise<void> {
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

    public async toggle(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, _reject) => {
            let ret: ServicePromise = null;
            ret = await this.updateState('toggle');
            resolve(ret);
        });
    }

    public get isOn(): boolean {
        return this.state == 'on';
    }

    public get isOff(): boolean {
        return this.state == 'off';
    }

    public get isTimerRunning(): boolean {
        return this._moment != 0;
    }

    public get timeBeforeOff(): number {
        return this._moment == 0
                ? 0
                : this._moment - Date.now();
    }

    public get support(): SUPPORT {
        return this._support;
    }

    public get isBrightnessSupported(): boolean {
        return !!(this.support & SUPPORT.SUPPORT_BRIGHTNESS);
    }

    public get isTemperatureSupported(): boolean {
        return !!(this._support & SUPPORT.SUPPORT_COLOR_TEMP);
    }

    public get brightness(): number {
        return this.isBrightnessSupported? this.attributes.brightness : NaN
    }

    public get temperature(): number {
        return this.isTemperatureSupported? this.attributes.color_temp : NaN
    }

    public get isSwitch(): boolean {
        return true;
    }

    // This function will be replaced if brightness is supported
    async updateBrightness(_newValue: number | string) { 
        return new Promise(resolve => resolve(new Error('Brightness is not supported')));
    }

    // This function will be replaced if temperature is supported
    async updateTemperature(_newValue: number | string) {
        return new Promise(resolve => resolve(new Error('Temperature is not supported')));
    }

    private async _updateBrightness(newValue: number | string): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var level = Number(newValue);
            if (level == NaN) {
                resolve({ message: 'Error', err: new Error('Brightness value must be a number between 1 and 254') });
            }
            else {
                if (level < 0) level = 0;
                else if (level > 254) level = 254;
                var { action, expectedNewState } = this._getActionAndExpectedNewState('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, brightness: level });
            }
        });
    }

    private async _updateTemperature(newValue: number | string): Promise<ServicePromise> {
        return new Promise<any>((resolve, _reject) => {
            var temp = Number(newValue);
            if (temp == NaN) {
                resolve({ message: 'Error', err: new Error('Color temperature must be numeric') });
            }
            else {
                if (temp < this.attributes.min_mireds) temp = this.attributes.min_mireds;
                else if (temp > this.attributes.max_mireds) temp = this.attributes.max_mireds;
                var { action, expectedNewState } = this._getActionAndExpectedNewState('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, color_temp: temp });
            }
        });
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }

    protected _getActionAndExpectedNewState(newState: boolean | number | string): ActionAndNewState {
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
                    : work == 'press'
                    ? 'press'
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
            ? ['off', 'on'][Number(this.isOff)]
            : action == 'press'
            ? '**'
            : 'error';
        return { action: action, expectedNewState: expectedNewState };
    }
}
