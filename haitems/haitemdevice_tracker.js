const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemDeviceTracker extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemDeviceTracker;