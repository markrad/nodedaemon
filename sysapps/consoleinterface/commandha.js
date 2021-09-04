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
exports.CommandHa = void 0;
const commandbase_1 = require("./commandbase");
class CommandHa extends commandbase_1.CommandBase {
    constructor() {
        super('ha', ['restart', 'stop', 'status']);
    }
    get helpText() {
        return `${this.commandName} \tstatus\t\t\tGet Home Assistant Status\r\n\trestart\t\t\tRestart Home Assistant\r\n\tstop\t\t\tStop Home Assistant`;
    }
    execute(inputArray, that, sock) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._validateParameters(inputArray);
                if (inputArray.length != 2) {
                    throw new Error(`Too many parameters passed for ${inputArray[1]}`);
                }
                switch (inputArray[1]) {
                    case 'restart':
                        sock.write('Restarting Home Assistant\r\n');
                        that.controller.restartHA();
                        break;
                    case 'stop':
                        sock.write('Stopping Home Assistant\r\n');
                        that.controller.stopHA();
                        break;
                    case 'status':
                        sock.write(`${that.controller.isConnected ? 'Connected' : 'Not connected'} to Home Assistant\r\n`);
                        break;
                    default:
                        throw new Error('Parameter validation error - this should not happen');
                }
            }
            catch (err) {
                sock.write(`${err}\r\n`);
                sock.write('Usage:\r\n');
                sock.write(this.helpText);
                sock.write('\r\n');
            }
        });
    }
}
exports.CommandHa = CommandHa;
//# sourceMappingURL=commandha.js.map