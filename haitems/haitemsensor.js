const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemSensor extends HaParentItem {
    constructor(item, transport) {
        super(item, transport);
        this.logger = log4js.getLogger(this.category);
        if (this.name.startsWith('rr_router')) {
            this.logger.level = 'info';
        }
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemSensor;