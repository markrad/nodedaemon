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
const haparentitem_1 = require("../../haitems/haparentitem");
// TODO Minimum conversion
const http = require('http');
var log4js = require('log4js');
const { resolve } = require('path');
const CATEGORY = 'UpdateExternalIP';
var logger = log4js.getLogger(CATEGORY);
class UpdateExternalIP {
    constructor(controller, config) {
        this.multiplier = 24;
        this.delay = 5;
        this.external_ip = haparentitem_1.SafeItemAssign(controller.items.getItem('var.external_ip'));
        this.config = config;
        this.delay = 5;
        this.multiplier = 24; // Check every two minutes
        this.interval = null;
        logger.debug('Constructed');
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let counter = 0;
            this.interval = setInterval((multiplier) => __awaiter(this, void 0, void 0, function* () {
                if (++counter % multiplier == 0) {
                    counter = 0;
                    try {
                        let currentIP = yield this.whatsMyIP();
                        logger.info(`Updating external IP address to ${currentIP}`);
                        this.external_ip.updateState(currentIP);
                    }
                    catch (err) {
                        logger.error(`Could not get IP address: ${err}`);
                    }
                }
            }), this.delay * 1000, this.multiplier);
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.interval);
        });
    }
    whatsMyIP() {
        return __awaiter(this, void 0, void 0, function* () {
            const IP_HOST = 'api.ipify.org';
            return new Promise((resolve, reject) => {
                const options = {
                    host: IP_HOST,
                    port: 80,
                    path: '/',
                };
                let allchunks = '';
                http.get(options, (res) => {
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