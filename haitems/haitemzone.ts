import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export default class HaItemZone extends HaParentItem {
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
    }

    public get longitude(): number {
        return this.attributes.longitude;
    }

    public get latitude(): number {
        return this.attributes.latitude;
    }

    public get radius(): number {
        return this.attributes.radius;
    }
}
