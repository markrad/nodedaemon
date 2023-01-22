import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericFixedItem } from './hagenericfixeditem';

export default class HaItemCamera  extends HaGenericFixedItem {
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
    }
}
