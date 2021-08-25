import { State } from '../hamain/index.js';
import { HaGenericSwitchItem } from './hagenericswitchitem.js';
import { ServiceTarget } from './haparentitem.js';

class HaItemLight extends HaGenericSwitchItem {
    public constructor(item: State) {
        super(item);
    }

    protected _childOveride(state: ServiceTarget): boolean {
        // HA will sometimes round slightly differently so a change of one point is not seen as a change and not send the update
        // If the brightness change is less than four points it will be rejected as already in that state.
        return !!state.brightness && Math.abs(Number(state.brightness) - Number(this.attributes.brightness)) > 2;
    }
}

module.exports = HaItemLight;