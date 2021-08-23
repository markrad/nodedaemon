"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hagenericswitchitem_js_1 = require("./hagenericswitchitem.js");
class HaItemLight extends hagenericswitchitem_js_1.HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
    }
    // TODO Figure out this type
    _childOveride(set) {
        // HA will sometimes round slightly differently so a change of one point is not seen as a change and not send the update
        // If the brightness change is less than four points it will be rejected as already in that state.
        return !!set.brightness && Math.abs(Number(set.brightness) - Number(this.attributes.brightness)) > 2;
    }
}
module.exports = HaItemLight;
//# sourceMappingURL=haitemlight.js.map