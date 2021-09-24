"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevelValidator = exports.LogLevels = void 0;
const log4js_1 = require("log4js");
function LogLevels() {
    const ignoreLevels = ['ALL', 'OFF', 'MARK'];
    return log4js_1.levels.levels
        .filter(item => !ignoreLevels.includes(item.levelStr))
        .map(item => item.levelStr);
}
exports.LogLevels = LogLevels;
function LogLevelValidator(value) {
    if (log4js_1.levels.getLevel(value) == undefined) {
        return false;
    }
    return true;
}
exports.LogLevelValidator = LogLevelValidator;
//# sourceMappingURL=loglevelvalidator.js.map