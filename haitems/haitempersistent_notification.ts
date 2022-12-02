import { State } from '../hamain/state'
import { HaGenericFixedItem } from './hagenericfixeditem';

export default class HaItemPersistentNotification extends HaGenericFixedItem {
    public constructor(item: State) {
        super(item);
    }
}
