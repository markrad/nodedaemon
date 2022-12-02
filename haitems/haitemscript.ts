import { State } from '../hamain/state'
import { HaGenericButtonItem } from './hagenericbuttonitem';

// TODO: Validate logic
export default class HaItemScript extends HaGenericButtonItem {
    public constructor(item: State) {
        super(item);
    }

    public get lastTriggered(): Date {
        return new Date(this.attributes?.last_triggered ?? NaN);
    }

    public get mode(): string {
        return this.attributes?.mode ?? 'unknown';
    }
}
