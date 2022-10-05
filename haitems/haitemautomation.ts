import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';
// TODO Add mechanism to activate it?
export default class HaItemAutomation extends HaGenericSwitchItem {
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
