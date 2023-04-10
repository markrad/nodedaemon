import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';
import { ServicePromise, HaParentItem, ServicePromiseResult } from './haparentitem';

enum SUPPORT {
    SET_SPEED = 1,
    OSCILLATE = 2,
    DIRECTION = 4,
    PRESET_MODE = 8
}

export default class HaItemFan extends HaGenericSwitchItem {
    // private _chainStateFn: (item: HaParentItem, state: State) => void;
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
        this._stateChangeFn = this._fanStateChangeFn;
        if (this.isSetSpeedSupported) {
            this.updateSpeed = this._updateSpeed;
        }
    }

    public async updateSpeed(_newValue: number | string) {
        return new Promise(resolve => resolve(new Error('Speed is not supported')));
    }

    // TODO: I doubt these work
    public async increaseSpeed(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, reject) => {
            if (!this.isSetSpeedSupported) {
                reject(new Error('Unsupported'));
            }
            else {
                let ret: ServicePromise = null;
                ret = await this.updateState('increase_speed');
                resolve(ret);
            }
        });
    }

    public async decreaseSpeed(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, reject) => {
            if (!this.isSetSpeedSupported) {
                reject(new Error('Unsupported'));
            }
            else {
                let ret: ServicePromise = null;
                ret = await this.updateState('decrease_speed');
                resolve(ret);
            }
        });
    }

    private async _updateSpeed(newValue: number | string): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var level = Number(newValue);
            if (isNaN(level)) {
                resolve({ result: ServicePromiseResult.Error, err: new Error('Speed value must be a number between 1 and 100') });
            }
            else {
                if (level < 0) level = 0;
                else if (level > 100) level = 100;
                var { action, expectedNewState } = this._getActionAndExpectedNewState('turn_on');
                this._callServicePromise(resolve, 'on', expectedNewState, this.type, action, { entity_id: this.entityId, percentage: level });
            }
        });
    }

    // TODO: Add set speed function

    public get isSetSpeedSupported(): boolean {
        return !!(this.attributes?.supported_features ?? 0 & SUPPORT.SET_SPEED);
    }

    private _fanStateChangeFn(item: HaParentItem, _state: State): void {
        this.logger.debug(`Received new state: ${item.state}${this.isSetSpeedSupported? " Percentage: " + item.attributes.percentage : ""}`);
    }
}
