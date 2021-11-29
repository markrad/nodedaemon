import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemPersistentNotification extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemPersistentNotification;