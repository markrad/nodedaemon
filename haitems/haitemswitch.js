"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hagenericswitchitem_1 = require("./hagenericswitchitem");
class HaItemSwitch extends hagenericswitchitem_1.HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
    }
}
module.exports = HaItemSwitch;
//# sourceMappingURL=haitemswitch.js.map