"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaItemAutomation = void 0;
const hagenericswitchitem_js_1 = require("./hagenericswitchitem.js");
// TODO Add mechanism to activate it?
class HaItemAutomation extends hagenericswitchitem_js_1.HaGenericSwitchItem {
    constructor(item) {
        super(item);
    }
    get lastTriggered() {
        var _a, _b;
        return new Date((_b = (_a = this.attributes) === null || _a === void 0 ? void 0 : _a.last_triggered) !== null && _b !== void 0 ? _b : NaN);
    }
    get mode() {
        var _a, _b;
        return (_b = (_a = this.attributes) === null || _a === void 0 ? void 0 : _a.mode) !== null && _b !== void 0 ? _b : 'unknown';
    }
}
exports.HaItemAutomation = HaItemAutomation;
module.exports = hagenericswitchitem_js_1.HaGenericSwitchItem;
//# sourceMappingURL=haitemautomation.js.map