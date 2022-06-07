import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemPersistentNotification extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemPersistentNotification;