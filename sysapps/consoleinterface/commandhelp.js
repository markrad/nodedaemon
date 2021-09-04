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
exports.CommandHelp = void 0;
const commandbase_1 = require("./commandbase");
class CommandHelp extends commandbase_1.CommandBase {
    constructor() {
        super('help');
    }
    get helpText() {
        return `${this.commandName}\t\t\t\tPrints this message`;
    }
    execute(inputArray, _that, sock, commands) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._validateParameters(inputArray);
                sock.write('Available commands:\r\n');
                commands.forEach((item) => sock.write(`${item.helpText}\r\n`));
            }
            catch (err) {
                sock.write(`${err}\r\n`);
            }
        });
    }
}
exports.CommandHelp = CommandHelp;
//# sourceMappingURL=commandhelp.js.map