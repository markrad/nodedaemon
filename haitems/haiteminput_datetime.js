const log4js = require('log4js')
const _ = require('underscore');

const HaParentItem = require('./haparentitem.js');

class HaItemInputDateTime extends HaParentItem {
    constructor(item, transport) {
        super(item, transport);
        this.logger = log4js.getLogger(this.category);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState) {
        var m = '';

        if (_.isDate(newState) == false) {
            m = new Date(newState);

            if (isNaN(newState.getDate())) {
                this.logger.error(`Specified date is invalid: ${m}`)
                return;
            }
        }
        else {
            m = newState;
        }
        let args = {
            entity_id: this.type + '.' + this.name,
            value: `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}-${m.getDate().toString().padStart(2, '0')} ` +
                `${m.getHours().toString().padStart(2, '0')}:${m.getMinutes().toString().padStart(2, '0')}:${m.getSeconds().toString().padStart(2, '0')}}`,
        };

        this._transport.callService('var', 'set', args);
    }
}

module.exports = HaItemInputDateTime;