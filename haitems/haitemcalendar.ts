import { Level } from 'log4js';
import { State } from '../hamain/state'
import { HaGenericBinaryItem } from './hagenericbinaryitem';

export default class HaItemCalendar extends HaGenericBinaryItem {
    public constructor(item: State, logLevel: Level) {
        super(item, logLevel);
    }
    get startTime(): string {
        return this.attributes['start_time'];
    }
    get endTime(): string {
        return this.attributes['end_time'];
    }
    get description(): string {
        return this.attributes['description'];
    }
    get location(): string {
        return this.attributes['location'];
    }
    get allDay(): boolean {
        return this.attributes['all_day'];
    }
}
