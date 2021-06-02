const HaParentItem = require('./haparentitem.js');

class HaItemZwave extends HaParentItem {
    constructor(item, transport) {
        super(item, transport);
        let x = this.category;
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemZwave;