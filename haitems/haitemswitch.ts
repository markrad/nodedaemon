import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';

class HaItemSwitch extends HaGenericSwitchItem {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }
}

module.exports = HaItemSwitch;