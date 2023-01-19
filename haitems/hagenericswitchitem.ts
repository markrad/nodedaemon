import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, HaParentItem, ServicePromise } from './haparentitem';
import { IHaItemSwitch } from "./ihaitemswitch";

// export enum SUPPORT {
//     SUPPORT_BRIGHTNESS = 1,
//     SUPPORT_COLOR_TEMP = 2,
//     SUPPORT_EFFECT = 4,
//     SUPPORT_FLASH = 8,
//     SUPPORT_COLOR = 16,
//     SUPPORT_TRANSITION = 32,
//     SUPPORT_WHITE_VALUE = 128,
// }

export class HaGenericSwitchItem extends HaGenericUpdateableItem implements IHaItemSwitch {
    private _moment: number;
    // private _support: SUPPORT;       
    private _timer: NodeJS.Timeout;
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
        this._moment = 0;
        this._timer = null;
        this._stateChangeFn = this._switchStateChangeFn;
        // this._support = this.attributes?.supported_features ?? 0;
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

    public get isSwitch(): boolean {
        return true;
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
        });
    }

    private _switchStateChangeFn(item: HaParentItem, oldState: State) {
        this._defaultStateChangeFn(item, oldState);
        if (this._moment != 0) {
            this.logger.debug('Cancelling off timer');
            clearTimeout(this._timer);
            this._timer = null;
            this._moment = 0;
        }
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
                    : work == 'increase_speed'
                    ? 'increase_speed'
                    : work == 'decrease_speed'
                    ? 'decrease_speed'
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
            : action == 'press' || action == 'increase_speed' || action == 'decrease_speed'
            ? '**'
            : 'error';
        return { action: action, expectedNewState: expectedNewState };
    }
}
