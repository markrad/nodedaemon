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
class HaItemInputNumber extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
    updateState(newState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                var { action, expectedNewState } = this._getActionAndExpectedSNewtate(newState);
                this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId, value: expectedNewState });
            });
        });
    }
    incrementState() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.updateState(Number(this.state) + 1);
        });
    }
    decrementState() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.updateState(Number(this.state - 1));
        });
    }
    get state() {
        return Number(super.state);
    }
    _getActionAndExpectedSNewtate(newState) {
        let action = 'set_value';
        let expectedNewState = null;
        if (isNaN(newState)) {
            action = 'error';
        }
        else {
            expectedNewState = newState.toString();
            if (Number(expectedNewState) > Number(this.attributes.max)) {
                expectedNewState = this.attributes.max;
            }
            else if (Number(expectedNewState) < Number(this.attributes.min)) {
                expectedNewState = this.attributes.min;
            }
        }
        return { action: action, expectedNewState: expectedNewState };
    }
}
module.exports = HaItemInputNumber;
//# sourceMappingURL=haiteminput_number.js.map