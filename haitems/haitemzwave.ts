import { HaParentItem } from './haparentitem.js';

class HaItemZwave extends HaParentItem {
    constructor(item: any, transport: any) {
        super(item, transport);
        // let x = this.category;
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemZwave;