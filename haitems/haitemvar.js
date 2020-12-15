const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemVar extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState) {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, 'var', action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    _getActionAndExpectedSNewtate(newState) {
        let action = 'set';
        let expectedNewState = newState.toString();

        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemVar;