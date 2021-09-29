import { State } from '../hamain/State'
import { HaParentItem } from './haparentitem';

class HaItemDeviceTracker extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemDeviceTracker;