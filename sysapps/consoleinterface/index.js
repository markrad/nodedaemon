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
exports.ConsoleInterface = void 0;
const log4js_1 = require("log4js");
const CATEGORY = 'ConsoleInterface';
var logger = log4js_1.getLogger(CATEGORY);
class ConsoleInterface {
    constructor(controller) {
        this._transports = [];
        this._controller = controller;
        this._items = controller.items;
    }
    validate(config) {
        this._config = config;
        logger.info('Constructed');
        return true;
    }
    get items() {
        return this._items;
    }
    get controller() {
        return this._controller;
    }
    run() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let name = this.controller.haConfig.location_name;
            // TODO Expose this to simplify the help command?
            let cmds = [
                new (require('./commandhelp')).CommandHelp(),
                new (require('./commandgetconfig')).CommandGetConfig(),
                new (require('./commanduptime')).CommandUptime(),
                new (require('./commandinspect')).CommandInspect(),
                new (require('./commandstop')).CommandStop(),
                new (require('./commandlist')).CommandList(),
                new (require('./commandapp')).CommandApp(),
                new (require('./commandha')).CommandHa(),
            ];
            if ((_a = this._config) === null || _a === void 0 ? void 0 : _a.transports) {
                try {
                    this._config.transports.forEach((transport) => {
                        try {
                            this._transports.push(new (require(transport))(name, this, cmds, this._config));
                        }
                        catch (err) {
                            logger.error(`Failed to create transport ${transport}: ${err}`);
                        }
                    });
                }
                catch (err) {
                    logger.error(`Failed to interate transports ${err}`);
                }
            }
            else {
                logger.warn('No transports specified');
            }
            this._transports.forEach((transport) => __awaiter(this, void 0, void 0, function* () { return yield transport.start(); }));
            return true;
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let rets = [];
                this._transports.forEach((transport) => __awaiter(this, void 0, void 0, function* () { return rets.push(transport.stop()); }));
                Promise.all(rets)
                    .then(() => resolve())
                    .catch((err) => reject(err));
            });
        });
    }
}
exports.ConsoleInterface = ConsoleInterface;
module.exports = ConsoleInterface;
//# sourceMappingURL=index.js.map