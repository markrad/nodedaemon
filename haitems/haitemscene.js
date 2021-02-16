const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemScene extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.logger.level = 'debug';
    }

    activate() {
        this.callService(this.type, 'turn_on', { entity_id: this.entityId });
    }
}

module.exports = HaItemScene;