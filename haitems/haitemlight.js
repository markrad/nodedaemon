"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hagenericswitchitem_1 = require("./hagenericswitchitem");
class HaItemLight extends hagenericswitchitem_1.HaGenericSwitchItem {
    constructor(item) {
        super(item);
    }
    _childOveride(state) {
        // HA will sometimes round slightly differently so a change of one point is not seen as a change and not send the update
        // If the brightness change is less than four points it will be rejected as already in that state.
        return !!state.brightness && Math.abs(Number(state.brightness) - Number(this.attributes.brightness)) > 2;
    }
}
module.exports = HaItemLight;
//# sourceMappingURL=haitemlight.js.map