import { State } from '../hamain/state'
import { HaGenericButtonItem } from './hagenericbuttonitem';

export class HaItemButton extends HaGenericButtonItem {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }
}

module.exports = HaItemButton;