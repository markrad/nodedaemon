import { State } from '../hamain/index.js';
import { HaParentItem } from './haparentitem.js';

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