import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';
import { Level } from 'log4js';

export default class HaItemUnknown extends HaParentItem {
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
        this.logger.warn(`Unknown entity: ${item.entity_id}`);
    }
}
