import { State } from '../hamain/index.js';
import { HaGenericSwitchItem } from './hagenericswitchitem.js';
// TODO Is this even used?
class HaItemAutomation extends HaGenericSwitchItem {
    constructor(item: State) {
        super(item);
    }
}

module.exports = HaGenericSwitchItem;