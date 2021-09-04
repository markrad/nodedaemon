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
exports.CommandGetConfig = void 0;
const commandbase_1 = require("./commandbase");
class CommandGetConfig extends commandbase_1.CommandBase {
    constructor() {
        super('getconfig');
    }
    get helpText() {
        return `${this.commandName}\t\t\tReturns the Home Assistand configuration`;
    }
    execute(inputArray, that, sock) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._validateParameters(inputArray);
                sock.write('Configuration:\r\n');
                sock.write(JSON.stringify(that.controller.haConfig, null, 2).replace(/\n/g, '\r\n'));
                sock.write('\r\n');
            }
            catch (err) {
                sock.write(`${err}\r\n`);
            }
        });
    }
}
exports.CommandGetConfig = CommandGetConfig;
//# sourceMappingURL=commandgetconfig.js.map