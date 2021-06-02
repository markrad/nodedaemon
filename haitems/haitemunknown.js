const HaParentItem = require('./haparentitem.js');

class HaItemUnknown extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.logger.warn('Unknown entity');
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemUnknown;