import { HaParentItem, ServicePromise, ServicePromiseResult } from './haparentitem';
import { IHaItem } from './ihaitem';
import { State } from '../hamain/state'
import { IHaItemFixed } from './ihaitemfixed';
import { Level } from 'log4js';

export class HaGenericFixedItem extends HaParentItem implements IHaItemFixed {
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
    }

    public async updateState(newState: string | number | boolean, forceUpdate: boolean): Promise<ServicePromise> {
        return new Promise<ServicePromise>((resolve, _reject) => {
            let waitChange = (newState: string | boolean | number): void => {
                let onChange = (that: IHaItem, _oldState: string | boolean | number) => {
                    if (that.state == newState) {
                        clearTimeout(timer);
                        this.off('new_state', onChange);
                        resolve({ result: ServicePromiseResult.Success })
                    }
                };
                this.on('new_state', onChange);
                let timer: NodeJS.Timer = setTimeout(() => {
                    let msg = 'Time out before state change';
                    this.logger.error(msg);
                    this.off('new_state', onChange);
                    resolve({ result: ServicePromiseResult.Error, err: new Error(msg)});
                }, 30000);
            }
            waitChange(newState);
            this.emit('callrestservice', this.entityId, newState, forceUpdate);
        });
    }

    public get isEditable(): boolean {
        return true;
    }
}
