import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericBinaryItem } from './hagenericbinaryitem';

export default class HaItemBinarySensor extends HaGenericBinaryItem {
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
    }
}
