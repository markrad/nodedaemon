import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericButtonItem } from './hagenericbuttonitem';

export default class HaItemButton extends HaGenericButtonItem {
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
    }
}
