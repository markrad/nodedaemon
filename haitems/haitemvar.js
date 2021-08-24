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
const hagenericupdatableitem_js_1 = require("./hagenericupdatableitem.js");
class HaItemVar extends hagenericupdatableitem_js_1.HaGenericUpdateableItem {
    constructor(item) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
    updateState(newState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
                var myResolve = (ret) => {
                    if (ret.message == 'success') {
                        // Call var.update to update icons etc.
                        this._callService(this.type, 'update', { entity_id: this.entityId });
                    }
                    resolve({ message: ret.message, err: ret.err });
                };
                this._callServicePromise(myResolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
            });
        });
    }
    _getActionAndExpectedSNewtate(newState) {
        let action = 'set';
        let expectedNewState = newState.toString();
        return { action: action, expectedNewState: expectedNewState };
    }
}
module.exports = HaItemVar;
//# sourceMappingURL=haitemvar.js.map