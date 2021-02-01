const log4js = require('log4js');

const HaGenericSwitchItem = require('./hagenericswitchitem.js');

class HaItemSwitch extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
        this.logger.level = 'debug';
    }
}

module.exports = HaItemSwitch;