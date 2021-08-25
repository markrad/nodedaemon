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
exports.CommandUptime = void 0;
const commandbase_1 = require("./commandbase");
class CommandUptime extends commandbase_1.CommandBase {
    constructor() {
        super('uptime');
    }
    get helpText() {
        return `${this.commandName}\t\t\t\tTime since last restart`;
    }
    execute(inputArray, that, sock) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._validateParameters(inputArray);
                let millis = (new Date().getTime() - that.controller.startTime.getTime());
                let seconds = (Math.floor((millis / 1000) % 60)).toString().padStart(2, '0') + ' second';
                let minutes = (Math.floor((millis / (1000 * 60)) % 60)).toString().padStart(2, '0') + ' minute';
                let hours = (Math.floor((millis / (1000 * 60 * 60)) % 24)).toString().padStart(2, '0') + ' hour';
                let days = (Math.floor(millis / (1000 * 60 * 60 * 24) % 24)).toString() + ' day';
                if (!seconds.startsWith('01'))
                    seconds += 's';
                if (!minutes.startsWith('01'))
                    minutes += 's';
                if (!hours.startsWith('01'))
                    hours += 's';
                if (!days.startsWith('1'))
                    days += 's';
                sock.write(`${days} ${hours} ${minutes} ${seconds}\r\n`);
            }
            catch (err) {
                sock.write(`${err}\r\n`);
            }
        });
    }
}
exports.CommandUptime = CommandUptime;
//# sourceMappingURL=commanduptime.js.map