import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';

class HaItemSwitch extends HaGenericSwitchItem {
    public constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
    }
}

module.exports = HaItemSwitch;