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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaParentItem = void 0;
const events_1 = __importDefault(require("events"));
const log4js_1 = require("log4js");
// import { AnyAaaaRecord, AnyARecord } from 'dns';
// Super slow for debugging
const RESPONSE_TIMEOUT_DEBUG = 30 * 1000;
const RESPONSE_TIMEOUT = 3 * 1000;
class HaParentItem extends events_1.default {
    constructor(item, _transport) {
        super();
        this._attributes = item.attributes;
        this._name = '';
        this._type = '';
        [this._type, this._name] = item.entity_id.split('.');
        this._friendlyName = item.attributes.friendly_name;
        this._lastChanged = new Date(item.last_changed);
        this._lastUpdated = new Date(item.last_updated);
        this._state = item.state;
        this._logger = log4js_1.getLogger(this.category);
    }
    get logger() {
        return this._logger;
    }
    get attributes() {
        var _a;
        return (_a = this._attributes) !== null && _a !== void 0 ? _a : {};
    }
    get name() {
        return this._name;
    }
    get friendlyName() {
        var _a;
        return (_a = this._friendlyName) !== null && _a !== void 0 ? _a : '';
    }
    get type() {
        return this._type;
    }
    get lastChanged() {
        return this._lastChanged;
    }
    get lastUpdated() {
        return this._lastUpdated;
    }
    get state() {
        return this._state;
    }
    get entityId() {
        return `${this.type}.${this.name}`;
    }
    get category() {
        return `${this.constructor.name}:${this.name}`;
        //return `${this.__proto__.constructor.name}:${this.name}`;
    }
    get isSwitch() {
        return false;
    }
    setReceivedState(newState) {
        let oldState = {
            attributes: this.attributes,
            state: this.state,
            lastUpdated: this.lastUpdated,
            lastChanged: this.lastChanged,
        };
        this._attributes = newState.attributes;
        this._state = newState.state;
        this._lastUpdated = new Date(newState.last_updated);
        this._lastChanged = new Date(newState.last_changed);
        this.emit('new_state', this, oldState);
    }
    updateState(_newState) {
        return __awaiter(this, void 0, void 0, function* () {
            let ret = new Promise((_resolve, reject) => {
                reject(new Error('Descendent class is required to implement updateState'));
            });
            return ret;
        });
    }
    callService(domain, service, state) {
        this.emit('callservice', domain, service, state);
    }
    _callServicePromise(resolve, newState, expectedState, domain, service, state) {
        if (service == 'error') {
            let err = new Error(`Bad value passed to updateState - ${newState}`);
            this.logger.error(`${err.message}`);
            resolve('error', err);
            return;
        }
        if (this.state != expectedState || this._childOveride(state)) {
            var timer = setTimeout(() => {
                var err = new Error('Timeout waiting for state change');
                this.logger.warn(`${err.message}`);
                resolve('error', err);
            }, RESPONSE_TIMEOUT);
            this.once('new_state', (that, _oldState) => {
                clearTimeout(timer);
                if (that.state == expectedState) {
                    resolve('success');
                }
                else {
                    var err = new Error('New state did not match expected state');
                    this.logger.info(`${err.message}`);
                    resolve('warn', err);
                }
            });
            this.callService(domain, service, state);
        }
        else {
            this.logger.debug(`Already in state ${this.state}`);
            resolve('nochange');
        }
    }
    _childOveride(state) {
        return false;
    }
    _getActionAndExpectedSNewtate(newState) {
        return { action: newState, expectedNewState: newState };
    }
}
exports.HaParentItem = HaParentItem;
//# sourceMappingURL=haparentitem.js.map