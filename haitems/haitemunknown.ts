import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemUnknown extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.logger.warn('Unknown entity');
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemUnknown;