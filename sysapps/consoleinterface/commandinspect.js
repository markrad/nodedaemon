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
exports.CommandInspect = void 0;
const log4js_1 = require("log4js");
const commandbase_1 = require("./commandbase");
const CATEGORY = 'CommandInspect';
var logger = log4js_1.getLogger(CATEGORY);
class CommandInspect extends commandbase_1.CommandBase {
    constructor() {
        super('inspect');
    }
    get helpText() {
        return `${this.commandName} <optional regex>\tInspect items optionally filtered by a regex query`;
    }
    tabParameters(that, tabCount, parameters) {
        let possibles = [...that._controller.items.items]
            .filter((item) => item[1].name.startsWith(parameters[1]))
            .map((item) => item[1].name)
            .sort((l, r) => l < r ? -1 : 1);
        return (possibles.length == 1 || tabCount > 1) ? possibles : [];
    }
    execute(inputArray, that, sock, _commands) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._validateParameters(inputArray.slice(0, inputArray.length - 1));
                if (inputArray.length != 2) {
                    throw new Error('Missing or invalid inspection target');
                }
                logger.debug(`inspect called with ${inputArray.join(' ')}`);
                let items = inputArray[1]
                    ? that.items.getItemByName(inputArray[1], true)
                    : that.items.getItemByName();
                items.forEach((item) => {
                    sock.write(`Entity Id = ${item.entityId}\r\n`);
                    sock.write(`Type = ${item.type}\r\n`);
                    sock.write(`State = ${item.state}\r\n`);
                    sock.write('Attributes:\r\n');
                    sock.write(`${JSON.stringify(item.attributes, null, 2).replace(/\n/g, '\r\n')}\r\n`);
                });
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
exports.CommandInspect = CommandInspect;
//# sourceMappingURL=commandinspect.js.map