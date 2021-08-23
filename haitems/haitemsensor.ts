import { State } from '../hamain/index.js';
import { HaParentItem } from './haparentitem.js';

class HaItemSensor extends HaParentItem {
    constructor(item: State) {
        super(item);
        if (this.name.startsWith('rr_router')) {
            this.logger.level = 'info';
        }
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemSensor;