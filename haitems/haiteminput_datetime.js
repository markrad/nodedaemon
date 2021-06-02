const HaParentItem = require('./haparentitem.js');

class HaItemInputDateTime extends HaParentItem {
    constructor(item) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    async updateState(newState) {
        return new Promise((resolve, _reject) => {
            var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);

            if (action == 'error') {
                err = new Error(`Bad value passed to updateState - ${newState}`);
                this.logger.error(`${err.message}`);
                resolve(action, err);
            }
            else {
                this._callServicePromise(resolve, newState, expectedNewState, 'var', action, { entity_id: this.entityId, value: exepectedNewState });
            }
        });
    }

    _getActionAndExpectedSNewtate(newState) {
        let action = 'set';
        let m = new Date(newState);
        let expectedNewState = '';

        if (isNaN(m.getDate())) {
            action = 'error';
        }
        else {
            expectedState = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}-${m.getDate().toString().padStart(2, '0')} ` +
            `${m.getHours().toString().padStart(2, '0')}:${m.getMinutes().toString().padStart(2, '0')}:${m.getSeconds().toString().padStart(2, '0')}}`
        }
        return { action: action, expectedNewState: expectedNewState };
    }
}

module.exports = HaItemInputDateTime;