import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';
import { ServicePromise } from './haparentitem';

export class HaGenericButtonItem extends HaGenericSwitchItem {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }

    public async press(): Promise<ServicePromise> {
        return new Promise<ServicePromise>(async (resolve, _reject) => {
            let ret: ServicePromise = null;
            ret = await this.updateState('press');
            resolve(ret);
        });
    }

    public get isButton() {
        return true;
    }
}
