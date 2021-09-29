import { State } from '../hamain/State'
import { HaGenericSwitchItem } from './hagenericswitchitem';

class HaItemSwitch extends HaGenericSwitchItem {
    public constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
    }
}

module.exports = HaItemSwitch;