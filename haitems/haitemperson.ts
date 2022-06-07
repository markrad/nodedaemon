import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemPerson extends HaParentItem {
    public constructor(item: State, logLevel: string) {
        super(item, logLevel);
    }
}

module.exports = HaItemPerson;
