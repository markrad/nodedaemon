import { HaParentItem } from './haparentitem.js';

class HaItemPersistentNotification extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemPersistentNotification;