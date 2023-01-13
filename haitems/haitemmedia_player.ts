import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericFixedItem } from './hagenericfixeditem';

export default class HaItemMediaPlayer extends HaGenericFixedItem {
    public constructor(item: State, loglevel: Level) {
        super(item, loglevel);
    }
}
