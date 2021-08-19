"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHa = void 0;
const log4js_1 = require("log4js");
const commandbase_1 = require("./commandbase");
const CATEGORY = 'CommandInspect';
var logger = log4js_1.getLogger(CATEGORY);
class CommandHa extends commandbase_1.CommandBase {
    constructor() {
        super('ha', ['restart', 'stop', 'status']);
    }
    get helpText() {
        return `${this.commandName} \tstatus\t\t\tGet Home Assistant Status\r\n\trestart\t\t\tRestart Home Assistant\r\n\tstop\t\t\tStop Home Assistant`;
    }
    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
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
    }
}
exports.CommandHa = CommandHa;
//# sourceMappingURL=commandha.js.map