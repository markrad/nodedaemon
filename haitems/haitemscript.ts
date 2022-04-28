import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';

export class HaItemScript extends HaGenericSwitchItem {
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

module.exports = HaItemScript;