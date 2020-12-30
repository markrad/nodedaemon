const log4js = require('log4js');

const HaGenericSwitchItem = require('./hagenericswitchitem.js');

class HaItemLight extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state} ${that.attributes.brightness? 'Brightness: ' + that.attributes.brightness : ''}`);
        });
    }

    async updateState(newState) {
        return new Promise((resolve, _reject) => {
            let { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
            let brightness = Number(newState);
            let set = { entity_id: this.entityId };

            if (action == 'turn_on' && NaN != brightness) {
                brightness == brightness > 100
                    ? 100
                    : brightness < 1
                    ? 1
                    : brightness;
                brightness = 255 / 100 * brightness
                set['brightness'] = brightness;
            }

            this._callServicePromise(resolve, newState, expectedNewState, this.type, action, set);
        });
    }

    _childOveride(set) {
        // HA will sometimes round slightly differently so a change of one point is not seen as a change and not send the update
        // If the brightness change is less than four points it will be rejected as already in that state.
        return !!set.brightness && Math.abs(Number(set.brightness) - Number(this.attributes.brightness)) > 3;
    }
}

module.exports = HaItemLight;