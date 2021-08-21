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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaItemFactory = void 0;
const fs_1 = __importDefault(require("fs"));
const log4js_1 = __importDefault(require("log4js"));
//var config = require('../config.json').main;
const CATEGORY = 'HaItemFactory';
var logger = log4js_1.default.getLogger(CATEGORY);
logger.level = 'info';
class HaItemFactory {
    constructor() {
        this._itemClasses = {};
        this._getItemObjects()
            .then(() => logger.debug('Objects acquired'))
            .catch((err) => {
            logger.error('Unable to walk directory of haitems');
            throw (err);
        });
    }
    getItemObject(item, transport) {
        let itemType = item.entity_id.split('.')[0];
        if (itemType in this._itemClasses) {
            return new this._itemClasses[itemType](item, transport);
        }
        else {
            return new this._itemClasses['unknown'](item, transport);
        }
    }
    _getItemObjects() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var e_1, _a;
                try {
                    const dir = yield fs_1.default.promises.opendir(__dirname);
                    try {
                        for (var dir_1 = __asyncValues(dir), dir_1_1; dir_1_1 = yield dir_1.next(), !dir_1_1.done;) {
                            const dirent = dir_1_1.value;
                            if (dirent.name.startsWith('haitem') && dirent.name.endsWith('.js')) {
                                let itemType = dirent.name.split('.')[0].substr(6);
                                this._itemClasses[itemType] = require('./' + dirent.name);
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (dir_1_1 && !dir_1_1.done && (_a = dir_1.return)) yield _a.call(dir_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            }));
        });
    }
}
exports.HaItemFactory = HaItemFactory;
//# sourceMappingURL=index.js.map