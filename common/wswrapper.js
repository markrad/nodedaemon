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
exports.WSWrapper = void 0;
const WebSocket = require("ws");
const log4js_1 = require("log4js");
const events_1 = __importDefault(require("events"));
const haInterfaceError_1 = require("./haInterfaceError");
const CATEGORY = 'WSWrapper';
var logger = log4js_1.getLogger(CATEGORY);
class WSWrapper extends events_1.default {
    constructor(url, pingRate) {
        super();
        if (!url)
            throw new Error('Error: WSWrapper requires url');
        this._url = url;
        this._pingRate = pingRate !== null && pingRate !== void 0 ? pingRate : 0;
        this._pingTimer = null;
        this._connected = false;
        this._closing = false;
        this._client = null;
        logger.debug(`Constructed with ${this._url}`);
    }
    open() {
        return __awaiter(this, void 0, void 0, function* () {
            this._closing = false;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                while (true) {
                    try {
                        logger.debug(`Connecting to ${this._url}`);
                        this._client = yield this._open(this._url);
                        logger.debug(`Connected to ${this._url}`);
                        this._connected = true;
                        this._client.on('message', (data) => {
                            logger.trace(`Data received:\n${JSON.stringify(data, null, 2)}`);
                            this.emit('message', data);
                        });
                        this._client.on('close', (code, reason) => __awaiter(this, void 0, void 0, function* () {
                            if (this._closing == false) {
                                logger.warn(`Connection closed by server: ${code} ${reason} - reconnecting`);
                                yield this.close();
                                yield this.open();
                            }
                        }));
                        this._client.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                            logger.warn(`Connection error: ${err.message} - reconnecting`);
                            yield this.close();
                            yield this.open();
                        }));
                        this._client.on('unexpected-response', (_clientRequest, _incomingMessage) => {
                            logger.warn('Unexpected response');
                        });
                        this._runPings();
                        resolve();
                        break;
                    }
                    catch (err) {
                        if (err instanceof haInterfaceError_1.DNSError) {
                            logger.fatal(`Unable to resolve host address: ${this._url}`);
                            reject(err);
                            break;
                        }
                        else if (err instanceof haInterfaceError_1.GenericSyscallError) {
                            logger.fatal(`Unhandled syscall error: ${err.syscall}`);
                            reject(err);
                            break;
                        }
                        else if (err instanceof haInterfaceError_1.ConnectionError) {
                            if (err.code != 'ECONNREFUSED') {
                                logger.fatal(`Unhandled connection error ${err.syscall} - ${err.errno}`);
                                reject(err);
                                break;
                            }
                            else {
                                logger.info(`${err.message} - retrying`);
                            }
                        }
                        else {
                            logger.fatal(`Unhandled error ${err.message}`);
                            reject(err);
                        }
                    }
                    yield new Promise(resolve => setTimeout(resolve, 1000));
                }
            }));
        });
    }
    send(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this._client.send(data, (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _reject) => __awaiter(this, void 0, void 0, function* () {
                this._closing = true;
                logger.info('Closing');
                this._connected = false;
                let timer = null;
                yield new Promise((resolve, _reject) => {
                    timer = setTimeout(() => {
                        logger.warn('Failed to close before timeout');
                        resolve(new Error('Failed to close connection'));
                    }, 5000);
                    this._client.once('close', (_reason, _description) => {
                        logger.info('Closed');
                    });
                    this._client.close();
                });
                clearTimeout(timer);
                this._client.removeAllListeners();
                resolve();
            }));
        });
    }
    get connected() {
        return this._connected;
    }
    _open(url) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                var client = new WebSocket(url);
                var connectFailed = (err) => {
                    client.off('connected', connectSucceeded);
                    reject(haInterfaceError_1.ErrorFactory(err));
                };
                var connectSucceeded = () => {
                    client.off('connectFailed', connectFailed);
                    resolve(client);
                };
                client.once('open', connectSucceeded);
                client.once('error', connectFailed);
            });
        });
    }
    _runPings() {
        if (this._pingRate > 0) {
            let pingId = 0;
            let pingOutstanding = 0;
            let pongWait = null;
            this._client.on('pong', (_data) => {
                clearTimeout(pongWait);
                pingOutstanding = 0;
            });
            this._pingTimer = setInterval(() => {
                if (!this._connected) {
                    clearInterval(this._pingTimer);
                }
                else {
                    if (pingOutstanding > 5) {
                        logger.warn(`Outstanding ping count: ${pingOutstanding}`);
                    }
                    pongWait = setTimeout(() => {
                        logger.warn('Pong not received');
                    }, 5000);
                    pingOutstanding++;
                    this._client.ping((++pingId).toString(), true);
                }
            }, this._pingRate * 1000);
        }
    }
}
exports.WSWrapper = WSWrapper;
//# sourceMappingURL=wswrapper.js.map