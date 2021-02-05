const HaGenericSwitchItem = require('./hagenericswitchitem.js');

const log4js = require('log4js');

const HaParentItem = require('./haparentitem.js');

class HaItemAutomation extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger = log4js.getLogger(this.category);
    }
}

module.exports = HaItemAutomation;