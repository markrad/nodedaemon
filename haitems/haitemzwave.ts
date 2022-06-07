import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemZwave extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemZwave;