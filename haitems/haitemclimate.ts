import { State } from '../hamain/index.js';
import { HaParentItem, IHaItem } from './haparentitem.js';

class HaItemClimate extends HaParentItem {
    constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemClimate;
