const HaParentItem = require('./haparentitem.js');

class HaItemZone extends HaParentItem {
    constructor(item) {
        super(item);
        let x = this.category;
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    get longitude() {
        return this.attributes.longitude;
    }

    get latitude() {
        return this.attributes.latitude;
    }

    get radius() {
        return this.attributes.radius;
    }
}

module.exports = HaItemZone;