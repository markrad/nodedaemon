import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemClimate extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemClimate;
