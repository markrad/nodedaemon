import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericFixedItem } from './hagenericfixeditem';

export default class HaItemNumber extends HaGenericFixedItem {
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
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
