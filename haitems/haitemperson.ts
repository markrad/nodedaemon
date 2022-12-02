import { State } from '../hamain/state'
import { HaGenericFixedItem } from './hagenericfixeditem';

export default class HaItemPerson extends HaGenericFixedItem {
    public constructor(item: State, logLevel: string) {
        super(item, logLevel);
    }
}
