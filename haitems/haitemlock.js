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
class HaItemLock extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
    lock() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.updateState('lock');
        });
    }
    unlock() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.updateState('unlock');
        });
    }
    get isLocked() {
        return this.state == 'locked';
    }
    get isUnlocked() {
        return this.state == 'unlocked';
    }
    updateState(newState) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                var { action, expectedNewState } = this._getActionAndExpectedNewState(newState);
                this._callServicePromise(resolve, newState, expectedNewState, this.type, action, { entity_id: this.entityId });
            });
        });
    }
    _getActionAndExpectedNewState(newState) {
        let action = '';
        switch (typeof newState) {
            case 'boolean':
                action = newState ? 'lock' : 'unlock';
                break;
            case 'number':
                action = newState == 0 ? 'unlock' : 'lock';
                break;
            case 'string':
                let work = newState.toLowerCase();
                action = work == 'lock'
                    ? 'lock'
                    : work == 'unlock'
                        ? 'unlock'
                        : work == 'turn_on'
                            ? 'lock'
                            : work == 'turn_off'
                                ? 'unlock'
                                : work == 'on'
                                    ? 'lock'
                                    : work == 'off'
                                        ? 'unlock'
                                        : 'error';
                break;
            default:
                action = 'error';
        }
        let expectedNewState = action == 'lock'
            ? 'locked'
            : action == 'unlock'
                ? 'unlocked'
                : 'error';
        return { action: action, expectedNewState: expectedNewState };
    }
}
module.exports = HaItemLock;
//# sourceMappingURL=haitemlock.js.map