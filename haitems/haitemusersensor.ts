import { State } from '../hamain/state'
import { HaGenericUpdateableItem } from './hagenericupdatableitem';
import { ActionAndNewState, ServicePromise } from './haparentitem';
import { IHaItem } from './ihaitem';

export default class HaItemUserSensor extends HaGenericUpdateableItem {
    public constructor(item: State) {
        super(item);
    }

    public async updateState(newState: string | boolean | number): Promise<ServicePromise> {
        return new Promise<ServicePromise>((resolve, _reject) => {
            let waitChange = (newState: string | boolean | number): void => {
                let onChange = (that: IHaItem, _oldState: string | boolean | number) => {
                    if (that.state == newState) {
                        clearTimeout(timer);
                        this.off('new_state', onChange);
                        resolve({ message: 'success', err: null })
                    }
                };
                this.on('new_state', onChange);
                let timer: NodeJS.Timer = setTimeout(() => {
                    this.logger.error('Time out before state change');
                    this.off('new_state', onChange);
                    resolve({ message: 'error', err: new Error('Time out before state change')});
                }, 5000);
            }
            waitChange(newState);
            this.emit('callrestservice', this.entityId, newState);
        });
    }

    protected _getActionAndExpectedNewState(newState: string | boolean | number): ActionAndNewState { 
        let action = 'set';
        let expectedNewState: string = newState.toString();

        return { action: action, expectedNewState: expectedNewState };
    }
}
