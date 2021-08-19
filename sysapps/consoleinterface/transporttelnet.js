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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = __importDefault(require("net"));
const log4js_1 = require("log4js");
const CATEGORY = 'TransportTelnet';
var logger = log4js_1.getLogger(CATEGORY);
class TransportTelnet {
    constructor(name, parent, commands, config) {
        var _a, _b;
        this._name = name;
        this._parent = parent;
        this._host = ((_a = config === null || config === void 0 ? void 0 : config.telnet) === null || _a === void 0 ? void 0 : _a.host) || '0.0.0.0';
        this._port = ((_b = config === null || config === void 0 ? void 0 : config.telnet) === null || _b === void 0 ? void 0 : _b.port) || 8821;
        this._commands = commands;
        this._server = null;
    }
    _parseAndSend(stream, cmd) {
        return __awaiter(this, void 0, void 0, function* () {
            let words = cmd.trim().split(' ');
            let command = this._commands.find((entry) => entry.commandName == words[0].toLowerCase());
            if (!command) {
                stream.write(`Unknown command: ${words[0]}\r\n`);
            }
            else {
                command.execute(words, this._parent, stream, this._commands);
            }
        });
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            this._server = net_1.default.createServer();
            this._server.on('connection', (sock) => __awaiter(this, void 0, void 0, function* () {
                sock.write(`\nConnected to ${this._name} - enter help for a list of commands\n\n`);
                sock.write(`${this._name} > `);
                logger.debug(`Socket connected ${sock.remoteAddress}`);
                sock.on('data', (data) => __awaiter(this, void 0, void 0, function* () {
                    if (data.toString() == 'exit\r\n') {
                        sock.write('Closing\n');
                        setTimeout(() => sock.end(), 500);
                    }
                    else {
                        yield this._parseAndSend(sock, data.toString());
                        sock.write(`${this._name} $ `);
                    }
                }));
                sock.on('close', () => {
                    logger.debug(`Socket ${sock.remoteAddress} closed`);
                });
            })).listen(this._port, this._host);
            logger.info(`Telnet server listening on port ${this._port}`);
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => {
                this._server.close(() => resolve());
            });
        });
    }
}
module.exports = TransportTelnet;
//# sourceMappingURL=transporttelnet.js.map