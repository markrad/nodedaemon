import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export class HaGenericBinaryItem extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }

    get isOn(): boolean { return this.state == 'on'; }
    get isOff(): boolean { return this.state == 'off'; }
}
