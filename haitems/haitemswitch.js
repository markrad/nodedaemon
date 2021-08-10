"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hagenericswitchitem_js_1 = require("./hagenericswitchitem.js");
class HaItemSwitch extends hagenericswitchitem_js_1.HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
    }
}
module.exports = HaItemSwitch;
//# sourceMappingURL=haitemswitch.js.map