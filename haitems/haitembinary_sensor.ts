import { State } from '../hamain/state'
import { HaGenericBinaryItem } from './hagenericbinaryitem';

export class HaItemBinarySensor extends HaGenericBinaryItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemBinarySensor;