import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export default class HaItemZwave extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}
