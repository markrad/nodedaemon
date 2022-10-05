import { State } from '../hamain/state'
import { HaGenericBinaryItem } from './hagenericbinaryitem';

export default class HaItemUpdate extends HaGenericBinaryItem {
    public constructor(item: State) {
        super(item);
    }
}
