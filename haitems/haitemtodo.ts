import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export default class HaItemTodo extends HaParentItem {
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
    }

    public get supportedFeatures(): number {
        return this.attributes.supported_features;
    }
}
