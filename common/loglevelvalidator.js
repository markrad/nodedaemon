"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevelValidator = void 0;
const log4js_1 = require("log4js");
function LogLevelValidator(value) {
    if (log4js_1.levels.getLevel(value) == log4js_1.levels.MARK) {
        return false;
    }
    return true;
}
exports.LogLevelValidator = LogLevelValidator;
//# sourceMappingURL=loglevelvalidator.js.map