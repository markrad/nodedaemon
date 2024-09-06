import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export default class HaItemTag extends HaParentItem {
    public constructor(item: State, logLevel: string | Level) {
        super(item, logLevel);
    }

    public get tagId(): string {
        return this.attributes.tag_id;
    }

    public get lastScannedByDeviceId(): number {
        return this.attributes.last_scanned_by_device_id;
    }
}
