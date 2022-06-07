import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemDeviceTracker extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemDeviceTracker;