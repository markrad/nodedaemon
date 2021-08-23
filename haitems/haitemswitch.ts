import { State } from '../hamain/index.js';
import { HaGenericSwitchItem } from './hagenericswitchitem.js';

class HaItemSwitch extends HaGenericSwitchItem {
    constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
    }
}

module.exports = HaItemSwitch;