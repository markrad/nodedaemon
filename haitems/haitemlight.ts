import { State } from '../hamain/index.js';
import { HaGenericSwitchItem } from './hagenericswitchitem.js';

class HaItemLight extends HaGenericSwitchItem {
    constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
    }

    // TODO Figure out this type
    _childOveride(set: any) {
        // HA will sometimes round slightly differently so a change of one point is not seen as a change and not send the update
        // If the brightness change is less than four points it will be rejected as already in that state.
        return !!set.brightness && Math.abs(Number(set.brightness) - Number(this.attributes.brightness)) > 2;
    }
}

module.exports = HaItemLight;