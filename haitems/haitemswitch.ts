import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';

export default class HaItemSwitch extends HaGenericSwitchItem {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }
}
