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
const wswrapper_1 = require("../../common/wswrapper");
const mqtt_1 = __importDefault(require("mqtt"));
const log4js_1 = require("log4js");
const CATEGORY = 'DeconzHack';
var logger = log4js_1.getLogger(CATEGORY);
class DeconzHack {
    constructor(_controller) {
        this._client = null;
        this._ws = null;
        logger.info('DeconzHack constructed');
    }
    validate(configIn) {
        var _a, _b;
        let config = configIn;
        if (!config.devices || config.devices.length == 0) {
            logger.error('Missing deconzhack.devices section in config - this is required');
            return false;
        }
        this._mqttConfig = Object.assign({ host: '127.0.0.1', port: 1883, topicTemplate: 'deconzhack/switch/device_%deviceid%' }, ((_a = config.mqtt) !== null && _a !== void 0 ? _a : {}));
        if (this._mqttConfig.topicTemplate.search('%deviceid%') == -1)
            this._mqttConfig.topicTemplate += '%deviceid%';
        this._deconzConfig = Object.assign({ host: '127.0.0.1', port: 8443 }, ((_b = config.deconz) !== null && _b !== void 0 ? _b : {}));
        this._devices = config.devices;
        logger.info('Validation successful');
        return true;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let client = 'deCONZHack';
                this._client = mqtt_1.default.connect(`mqtt://${this._mqttConfig.host}:${this._mqttConfig.port}`, { clientId: client, clean: true });
                this._client.on('error', err => logger.warn(`MQTT error ${err}`));
                this._client.on('reconnect', () => logger.warn('MQTT is reconnecting'));
                yield new Promise(resolve => this._client.once('connect', resolve));
                logger.info('Connected to MQTT server');
                this._ws = new wswrapper_1.WSWrapper(`ws://${this._deconzConfig.host}:${this._deconzConfig.port}`, 60);
                this._ws.on('message', (msg) => {
                    var _a;
                    var msgData = JSON.parse(msg);
                    logger.trace(`Received:\n${JSON.stringify(msgData, null, 2)}`);
                    if ((_a = msgData.state) === null || _a === void 0 ? void 0 : _a.buttonevent) {
                        let index = this._devices.find((item) => item.uniqueId == msgData.uniqueid);
                        if (index != undefined) {
                            logger.debug(`Device ${index.uniqueId} state changed to ${msgData.state.buttonevent}`);
                            this._client.publish(this._mqttConfig.topicTemplate.replace('%deviceid%', index.target), msgData.state.buttonevent.toString());
                        }
                    }
                });
                yield this._ws.open();
                logger.info('Connected to deCONZ server');
                resolve(true);
            }));
        });
    }
    send(data) {
        this._ws.send(data);
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => __awaiter(this, void 0, void 0, function* () {
                yield this._ws.close();
                this._client.end(false, null, resolve);
            }));
        });
    }
}
module.exports = DeconzHack;
//# sourceMappingURL=index.js.map