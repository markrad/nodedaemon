"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const hagenericswitchitem_1 = require("./hagenericswitchitem");
class HaItemGroup extends hagenericswitchitem_1.HaGenericSwitchItem {
    constructor(item) {
        super(item);
        this._children = item.attributes.entity_id;
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
    updateState(newState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
                this._callServicePromise(resolve, newState, expectedNewState, 'homeassistant', action, { entity_id: this.entityId, value: expectedNewState });
            });
        });
    }
    get children() {
        return this._children;
    }
}
module.exports = HaItemGroup;
//# sourceMappingURL=haitemgroup.js.map