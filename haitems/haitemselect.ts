import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, ServicePromise, ServicePromiseResult } from './haparentitem';

export default class HaItemSelect extends HaGenericUpdateableItem {
    private _allowedStates: string[];
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
        this._allowedStates = item.attributes.options;
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise<ServicePromise>((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState as string);

            if (action == 'error') {
                let err: Error = new Error(`Value is not included in select list - ${newState}`);
                this.logger.error(`${err.message}`);
                resolve({ result: ServicePromiseResult.Error, err: err });
            }
            else {
                this._callServicePromise(resolve, newState, expectedNewState, 'var', action, { entity_id: this.entityId, value: expectedNewState });
            }
        });
    }

    public get allowedStates(): string[] {
        return this._allowedStates;
    }

    protected _getActionAndExpectedNewState(newState: string): ActionAndNewState { 
        let action: string = 'set';
        let expectedNewState: string = '';

        if (!this._allowedStates.includes(newState)) {
            action = 'error';
        }
        else {
            expectedNewState = newState.toString();
        }

        return { action: action, expectedNewState: expectedNewState };
    }
}
