const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemSun extends HaParentItem {
    constructor(item, transport) {
        super(item, transport);
        let x = this.category;
        this.logger = log4js.getLogger(this.category);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemSun;