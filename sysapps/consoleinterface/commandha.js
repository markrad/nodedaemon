"use strict";

var log4js = require('log4js');
const CommandBase = require('./commandbase');

const CATEGORY = 'CommandInspect';
var logger = log4js.getLogger(CATEGORY);

class CommandHa extends CommandBase {
    constructor() {
        super('ha', ['restart', 'stop', 'status']);
    }

    get helpText() {
        return `${this.commandName} \tstatus\t\t\tGet Home Assistant Status\r\n\trestart\t\t\tRestart Home Assistant\r\n\tstop\t\t\tStop Home Assistant`;
    }

    execute(inputArray, that, sock) {
        try {
            this.validateParameters(inputArray);
            switch (inputArray[1]) {
                case 'restart':
                    if (inputArray.length != 2) {
                        throw new Error(`Too many parameters passed`);
                    }
                    sock.write('Restarting Home Assistant\r\n');
                    that.controller.restartHA();
                break;
                case 'stop':
                    if (inputArray.length != 2) {
                        throw new Error(`Too many parameters passed`);
                    }
                    sock.write('Stopping Home Assistant\r\n');
                    that.controller.stopHA();
                break;
                case 'status':
                    if (inputArray.length != 2) {
                        throw new Error(`Too many parameters passed`);
                    }
                    sock.write(`${that.controller.isConnected? 'Connected' : 'Not connected'} to Home Assistant\r\n`)
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

module.exports = CommandHa