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
const haparentitem_js_1 = require("./haparentitem.js");
class HaItemScene extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
    }
    activate() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.updateState('turn_on');
        });
    }
    updateState(newState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
                this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
            });
        });
    }
}
module.exports = HaItemScene;
//# sourceMappingURL=haitemscene.js.map