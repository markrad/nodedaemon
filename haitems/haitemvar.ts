import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, ServicePromise, ServicePromiseResult } from './haparentitem';

export default class HaItemVar extends HaGenericUpdateableItem {
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise<ServicePromise>((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedNewState(newState as string);
            var myResolve = (ret: ServicePromise) => {
                if (ret.result == ServicePromiseResult.Success) {
                    // Call var.update to update icons etc.
                    this._callService(this.type, 'update', { entity_id: this.entityId });
                    this.logger.debug(`Set var ${this.entityId} to ${newState}`)
                }
                resolve({ result: ret.result, err: ret.err });
            }

            this._callServicePromise(myResolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    protected _getActionAndExpectedNewState(newState: string): ActionAndNewState { 
        let action = 'set';
        let expectedNewState = newState.toString();

        return { action: action, expectedNewState: expectedNewState };
    }
}
