import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemSun extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemSun;