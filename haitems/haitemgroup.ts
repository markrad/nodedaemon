import { State } from '../hamain/state'
import { HaGenericSwitchItem } from './hagenericswitchitem';
import { ServicePromise } from './haparentitem';

export default class HaItemGroup extends HaGenericSwitchItem {
    private _children: string[];
    public constructor(item: State) {
        super(item);
        this._children = item.attributes.entity_id;
    }

    public async updateState(newState: string | number | boolean): Promise<ServicePromise> {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
            this._callServicePromise(resolve, newState, expectedNewState, 'homeassistant', action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    public get children() : string[] {
        return this._children;
    }
}
