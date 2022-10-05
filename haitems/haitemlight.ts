import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';
import { ServiceTarget, ServicePromise, HaParentItem } from './haparentitem';

// enum SUPPORT {
//     SUPPORT_BRIGHTNESS = 1,
//     SUPPORT_COLOR_TEMP = 2,
//     SUPPORT_EFFECT = 4,
//     SUPPORT_FLASH = 8,
//     SUPPORT_COLOR = 16,
//     SUPPORT_TRANSITION = 32,
//     SUPPORT_WHITE_VALUE = 128,
// }

export default class HaItemLight extends HaGenericSwitchItem {
    private _saveStateChangeFn: (item: HaParentItem, state: State) => void;
    public constructor(item: State) {
        super(item);
        if (this.isBrightnessSupported) this.updateBrightness = this._updateBrightness;
        if (this.isTemperatureSupported) this.updateTemperature = this._updateTemperature;
        this._saveStateChangeFn = this._stateChangeFn;
        this._stateChangeFn = this._lightStateChangeFn;
    }

    protected _childOveride(state: ServiceTarget): boolean {
        // HA will sometimes round slightly differently so a change of one point is not seen as a change and not send the update
        // If the brightness change is less than four points it will be rejected as already in that state.
        return !!state.brightness && Math.abs(Number(state.brightness) - Number(this.attributes.brightness)) > 2;
    }

    public get isBrightnessSupported(): boolean {
        return (this.attributes?.supported_color_modes ?? []).includes('color_temp') || (this.attributes?.supported_color_modes ?? []).includes('brightness');
    }

    public get isTemperatureSupported(): boolean {
        return (this.attributes?.supported_color_modes ?? []).includes('brightness');
    }

    public get brightness(): number {
        return this.isBrightnessSupported? this.attributes.brightness : NaN
    }

    public get temperature(): number {
        return this.isTemperatureSupported? this.attributes.color_temp : NaN
    }

    // This function will be replaced if brightness is supported
    public async updateBrightness(_newValue: number | string) { 
        return new Promise(resolve => resolve(new Error('Brightness is not supported')));
    }

    // This function will be replaced if temperature is supported
    public async updateTemperature(_newValue: number | string) {
        return new Promise(resolve => resolve(new Error('Temperature is not supported')));
    }

    private _lightStateChangeFn(item: HaParentItem, state: State): void {
        let that: HaItemLight = item as HaItemLight;
        let brightnessMsg = `${that.isOn && that.isBrightnessSupported? 'Brightness: ' + that.brightness : ''}`;
        let tempMsg = `${that.isOn && that.isTemperatureSupported? 'Temperature: ' + that.temperature : ''}`;
        this.logger.debug(`Received new state: ${that.state} ${brightnessMsg} ${tempMsg}`);
        this._saveStateChangeFn(that, state);
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
}
