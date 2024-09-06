import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export default class HaItemStt extends HaParentItem {
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
    }
}
