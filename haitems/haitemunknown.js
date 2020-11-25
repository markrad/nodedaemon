const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemUnknown extends HaParentItem {
    constructor(item, transport) {
        super(item, transport);
        let x = this.category;
        this.logger = log4js.getLogger(this.category);
        this.logger.level = 'info';
        this.logger.warn('Unknown entity');
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemUnknown;