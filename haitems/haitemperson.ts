import { State } from '../hamain/index.js';
import { HaParentItem } from './haparentitem.js';

class HaItemPerson extends HaParentItem {
    constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemPerson;
