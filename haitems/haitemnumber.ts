import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export default class HaItemNumber extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }

    get min(): number {
        return this.attributes.min;
    }

    get max(): number {
        return this.attributes.max;
    }

    get step(): number {
        return this.attributes.step;
    }

    get mode(): string {
        return this.attributes.mode;
    }
}
