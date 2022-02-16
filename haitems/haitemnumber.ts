import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export class HaItemNumber extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    get min(): number {
        return this.attributes.min;
    }

    get max(): number {
        return this.attributes.max;
    }

    get step(): number {
        return this.attributes.step;
    }

    get mode(): string {
        return this.attributes.mode;
    }
}

module.exports = HaItemNumber;