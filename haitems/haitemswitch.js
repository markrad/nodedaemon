const HaGenericSwitchItem = require('./hagenericswitchitem.js');

class HaItemSwitch extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
    }
}

module.exports = HaItemSwitch;