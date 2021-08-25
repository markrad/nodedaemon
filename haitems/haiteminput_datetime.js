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
class HaItemInputDateTime extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
    updateState(newState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                let { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
                if (action == 'error') {
                    let err = new Error(`Bad value passed to updateState - ${newState}`);
                    this.logger.error(`${err.message}`);
                    resolve({ message: action, err: err });
                }
                else {
                    this._callServicePromise(resolve, newState, expectedNewState, 'var', action, { entity_id: this.entityId, value: expectedNewState });
                }
            });
        });
    }
    _getActionAndExpectedNewState(newState) {
        let action = 'set';
        let m = new Date(newState);
        let expectedNewState;
        if (isNaN(m.getDate())) {
            action = 'error';
        }
        else {
            expectedNewState = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}-${m.getDate().toString().padStart(2, '0')} ` +
                `${m.getHours().toString().padStart(2, '0')}:${m.getMinutes().toString().padStart(2, '0')}:${m.getSeconds().toString().padStart(2, '0')}}`;
        }
        return { action: action, expectedNewState: expectedNewState };
    }
}
module.exports = HaItemInputDateTime;
//# sourceMappingURL=haiteminput_datetime.js.map