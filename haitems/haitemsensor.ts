import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export class HaItemSensor extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemSensor;