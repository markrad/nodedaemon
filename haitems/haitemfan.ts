import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';
import { ServicePromise } from './haparentitem';

enum SUPPORT {
    SET_SPEED = 1,
    OSCILLATE = 2,
    DIRECTION = 4,
    PRESET_MODE = 8
}

export class HaItemFan extends HaGenericSwitchItem {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }

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

    public get isSetSpeedSupported(): boolean {
        return !!(this.attributes?.supported_features ?? 0 & SUPPORT.SET_SPEED);
    }
}

module.exports = HaItemFan;