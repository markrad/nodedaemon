const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemVar extends HaParentItem {
    constructor(item, transport) {
        super(item, transport);
        this.logger = log4js.getLogger(this.category);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    updateState(newState) {
        let args = {
            entity_id: this.type + '.' + this.name,
            value: newState,
        };

        this.callService('var', 'set', args);
    }
}

module.exports = HaItemVar;