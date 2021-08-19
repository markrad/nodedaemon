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
const log4js_1 = require("log4js");
const commandbase_1 = require("./commandbase");
const CATEGORY = 'CommandStop';
var logger = log4js_1.getLogger(CATEGORY);
class CommandStop extends commandbase_1.CommandBase {
    constructor() {
        super('stop');
    }
    get helpText() {
        return `${this.commandName}\t\t\t\tStops the service`;
    }
    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
            logger.debug('Stop called');
            sock.write('Requested stop will occur in five seconds\r\n');
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                yield that.controller.stop();
                process.exit(0);
            }), 5000);
        }
        catch (err) {
            sock.write(`${err}\r\n`);
        }
    }
}
module.exports = CommandStop;
//# sourceMappingURL=commandstop.js.map