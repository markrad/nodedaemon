import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericFixedItem } from './hagenericfixeditem';

export class HaGenericBinaryItem extends HaGenericFixedItem {
    public constructor(item: State, loglevel: Level) {
        super(item, loglevel);
    }

    get isOn(): boolean { return this.state == 'on'; }
    get isOff(): boolean { return this.state == 'off'; }
}
