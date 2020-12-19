const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemZone extends HaParentItem {
    constructor(item) {
        super(item);
        let x = this.category;
        this.logger = log4js.getLogger(this.category);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    get longitude() {
        return this._itemAttributes.longitude;
    }

    get latitude() {
        return this._itemAttributes.latitude;
    }

    get radius() {
        return this._itemAttributes.radius;
    }
}

module.exports = HaItemZone;