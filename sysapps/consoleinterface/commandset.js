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
exports.CommandSet = void 0;
const log4js_1 = require("log4js");
const commandbase_1 = require("./commandbase");
const haparentitem_1 = require("../../haitems/haparentitem");
const CATEGORY = 'CommandSet';
var logger = log4js_1.getLogger(CATEGORY);
class CommandSet extends commandbase_1.CommandBase {
    constructor() {
        super('set', ['state', 'logging', 'on', 'off', 'toggle']);
    }
    get helpText() {
        return `${this.commandName}\tstate\r\n\ton\r\n\toff\r\n\ttoggle\t\t\tManipulate properties of item`;
    }
    tabParameters(that, tabCount, parameters) {
        let possibles;
        if (parameters.length == 3) {
            possibles = [...that.controller.items.items]
                .filter((item) => item[1].entityId.startsWith(parameters[2]))
                .map((item) => item[1].entityId)
                .sort((l, r) => l < r ? -1 : 1);
        }
        else if (parameters.length = 2) {
            possibles = this.parameters
                .filter((item) => item.startsWith(parameters[1]))
                .sort((l, r) => l.localeCompare(r));
        }
        return (possibles.length == 1 || tabCount > 1) ? possibles : [];
    }
    execute(inputArray, that, sock, _commands) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._validateParameters(inputArray);
                if (inputArray.length < 3) {
                    throw new Error('Requires command and target item');
                }
                logger.debug(`set called with ${inputArray.join(' ')}`);
                let item = that.items.getItemByName(inputArray[2], false);
                if (item.length != 1) {
                    throw new Error(`Item ${inputArray[2]} was not found`);
                }
                if (!item[0].isEditable) {
                    throw new Error(`Specified item ${inputArray[2]} is not editable`);
                }
                let target = haparentitem_1.SafeItemAssign(item[0]);
                let rc;
                switch (inputArray[1]) {
                    case "state":
                        if (inputArray.length < 4) {
                            throw new Error(`set state requires a new state be provided`);
                        }
                        if (inputArray.length > 4) {
                            throw new Error(`set state requires a new state to be a single word`);
                        }
                        rc = yield target.updateState(inputArray[3]);
                        if (rc.err) {
                            sock.write(`Error: Command ${inputArray[3]} failed for ${target.entityId}: ${rc.err.message}\r\n`);
                        }
                        else {
                            sock.write(`Command complete - new state ${target.state}\r\n`);
                        }
                        break;
                    case "on":
                    case "off":
                    case "toggle":
                        if (!item[0].isSwitch) {
                            throw new Error('subcommand can only target a switch');
                        }
                        rc = yield target.updateState(inputArray[1]);
                        if (rc.err) {
                            sock.write(`Error: Command ${inputArray[3]} failed for ${target.entityId}: ${rc.err.message}\r\n`);
                        }
                        else {
                            sock.write(`Command complete - new state ${target.state}\r\n`);
                        }
                        break;
                    case "logging":
                        sock.write('Not implemented\r\n');
                        break;
                    default:
                        throw new Error(`Command ${inputArray[1]} is invalid`);
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
exports.CommandSet = CommandSet;
//# sourceMappingURL=commandset.js.map