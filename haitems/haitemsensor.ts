import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export class HaItemSensor extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemSensor;