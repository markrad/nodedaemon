import { Logger } from 'log4js';
import { HaGenericSwitchItem } from './hagenericswitchitem.js';

class HaItemSwitch extends HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
    }
}

module.exports = HaItemSwitch;