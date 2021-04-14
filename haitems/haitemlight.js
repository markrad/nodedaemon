const log4js = require('log4js');

const HaGenericSwitchItem = require('./hagenericswitchitem.js');

class HaItemLight extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.logger.level = 'debug';
    }

    _childOveride(set) {
        // HA will sometimes round slightly differently so a change of one point is not seen as a change and not send the update
        // If the brightness change is less than four points it will be rejected as already in that state.
        return !!set.brightness && Math.abs(Number(set.brightness) - Number(this.attributes.brightness)) > 2;
    }
}

module.exports = HaItemLight;