import { State } from '../hamain/state'
import { HaGenericBinaryItem } from './hagenericbinaryitem';

export class HaItemUpdate extends HaGenericBinaryItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemUpdate;