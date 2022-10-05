import { State } from '../hamain/state'
import { HaGenericButtonItem } from './hagenericbuttonitem';

export default class HaItemInputButton extends HaGenericButtonItem {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }
}
