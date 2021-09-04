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
const haparentitem_1 = require("../../haitems/haparentitem");
const http_1 = __importDefault(require("http"));
const log4js_1 = require("log4js");
const CATEGORY = 'UpdateExternalIP';
var logger = log4js_1.getLogger(CATEGORY);
class UpdateExternalIP {
    constructor(controller, config) {
        this._interval = null;
        this._multiplier = 24;
        this._delay = 5;
        this._external_ip = haparentitem_1.SafeItemAssign(controller.items.getItem('var.external_ip'));
        this._config = config;
        logger.debug('Constructed');
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let counter = 0;
            this._interval = setInterval((multiplier) => __awaiter(this, void 0, void 0, function* () {
                if (++counter % multiplier == 0) {
                    counter = 0;
                    try {
                        let currentIP = yield this._whatsMyIP();
                        logger.info(`Updating external IP address to ${currentIP}`);
                        this._external_ip.updateState(currentIP);
                    }
                    catch (err) {
                        logger.error(`Could not get IP address: ${err}`);
                    }
                }
            }), this._delay * 1000, this._multiplier);
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this._interval);
        });
    }
    _whatsMyIP() {
        return __awaiter(this, void 0, void 0, function* () {
            const IP_HOST = 'api.ipify.org';
            return new Promise((resolve, reject) => {
                const options = {
                    host: IP_HOST,
                    port: 80,
                    path: '/',
                };
                let allchunks = '';
                http_1.default.get(options, (res) => {
                    if (res.statusCode != 200) {
                        let err = new Error(`Error status code returned from IP server ${res.statusCode}`);
                        logger.error(err.message);
                        reject(err);
                    }
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => allchunks += chunk);
                    res.on('end', () => resolve(allchunks));
                }).on('error', (err) => {
                    logger.error(`Failed to connect to ${IP_HOST}: ${err}`);
                    reject(err);
                });
            });
        });
    }
}
module.exports = UpdateExternalIP;
//# sourceMappingURL=index.js.map