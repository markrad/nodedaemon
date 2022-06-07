import { State } from '../hamain/state';
import { HaParentItem } from './haparentitem';

class HaItemRemote extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemRemote;