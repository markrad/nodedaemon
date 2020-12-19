const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemInputNumber extends HaParentItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState) {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
        });
    }

    async incrementState() {
        return this.updateState(Number(this.state) + 1);
    }

    async decrementState() {
        return this.updateState(Number(this.state - 1));
    }

    get state() {
        return Number(super.state);
    }

    _getActionAndExpectedSNewtate(newState) {
        let action = 'set_value';
        let expectedNewState = null;

        if (isNaN(newState)) {
            action = 'error';
        }
        else {
            expectedNewState = newState.toString();
        }

        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemInputNumber;