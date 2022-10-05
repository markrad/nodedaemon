import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export default class HaItemUnknown extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.logger.warn(`Unknown entity: ${item.entity_id}`);
    }
}
