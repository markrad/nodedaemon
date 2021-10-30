import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';

class HaItemSwitch extends HaGenericSwitchItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemSwitch;