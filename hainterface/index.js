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
exports.HaInterface = void 0;
const events_1 = __importDefault(require("events"));
const WebSocket = require("ws");
const log4js_1 = require("log4js");
const haInterfaceError_1 = require("../common/haInterfaceError");
var PacketTypes;
(function (PacketTypes) {
    PacketTypes[PacketTypes["ServiceAuthRequired"] = 0] = "ServiceAuthRequired";
    PacketTypes[PacketTypes["ServiceAuthOk"] = 1] = "ServiceAuthOk";
    PacketTypes[PacketTypes["ServiceAuthInvalid"] = 2] = "ServiceAuthInvalid";
    PacketTypes[PacketTypes["ServiceError"] = 3] = "ServiceError";
    PacketTypes[PacketTypes["ServiceSuccess"] = 4] = "ServiceSuccess";
    PacketTypes[PacketTypes["ServicePong"] = 5] = "ServicePong";
    PacketTypes[PacketTypes["ServiceEvent"] = 6] = "ServiceEvent";
})(PacketTypes || (PacketTypes = {}));
const CATEGORY = 'HaInterface';
var logger = log4js_1.getLogger(CATEGORY);
if (process.env.HAINTERFACE_LOGGING) {
    logger.level = process.env.HAINTERFACE_LOGGING;
}
class HaInterface extends events_1.default {
    constructor(url, accessToken, pingRate = 60000) {
        super();
        this.accessToken = accessToken;
        this.client = null;
        this.url = url;
        this.id = 0;
        this.tracker = new Map();
        this.pingRate = pingRate;
        this.pingInterval = null;
        this.closing = false;
        this.connected = false;
    }
    _messageFactory(msgJSON) {
        let msg = JSON.parse(msgJSON);
        switch (msg.type) {
            case "result":
                return msg.success == true
                    ? { name: PacketTypes.ServiceSuccess, id: msg.id, type: "result", success: true, result: msg.result }
                    : { name: PacketTypes.ServiceError, id: msg.id, type: "result", success: false, error: msg.error };
            case "event":
                return { name: PacketTypes.ServiceEvent, type: msg.type, event: msg.event };
            case "pong":
                return { name: PacketTypes.ServicePong, id: msg.id, type: "pong" };
            case "auth_ok":
                return { name: PacketTypes.ServiceAuthOk, type: msg.type, ha_version: msg.ha_version };
            case "auth_invalid":
                return { name: PacketTypes.ServiceAuthInvalid, type: msg.type, message: msg.message };
            default:
                let errMsg = `Unrecognized server response: ${msgJSON}`;
                logger.error(errMsg);
                throw new Error(errMsg);
        }
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    this.client = yield this._connect(this.url);
                    logger.info(`Connection complete`);
                    this.connected = true;
                    this.client.on('message', (message) => {
                        if (typeof message != 'string') {
                            logger.warn(`Unrecognized message type: ${typeof message}`);
                        }
                        else {
                            // let msg = JSON.parse(message);
                            let msg = this._messageFactory(message);
                            if (msg.name == PacketTypes.ServiceEvent) {
                                let msgEvent = msg;
                                logger.trace(`msg.event.event_type=${msgEvent.event.event_type}`);
                                this.emit(msgEvent.event.event_type, msgEvent.event.data);
                                return;
                            }
                            let msgResponse;
                            switch (msg.name) {
                                case PacketTypes.ServiceSuccess:
                                    msgResponse = msg;
                                    break;
                                case PacketTypes.ServiceError:
                                    msgResponse = msg;
                                    break;
                                case PacketTypes.ServicePong:
                                    msgResponse = msg;
                                    break;
                            }
                            try {
                                this.tracker.get(msgResponse.id).handler(msgResponse);
                                this.tracker.delete(msgResponse.id);
                            }
                            catch (_a) {
                                logger.fatal('This should never happen. Send packets should always have a response handler');
                            }
                        }
                    });
                    var restart = (that) => __awaiter(this, void 0, void 0, function* () {
                        that._kill();
                        try {
                            yield that.start();
                            that.connected = true;
                            logger.info(`Reconnection complete`);
                            that.emit('reconnected');
                        }
                        catch (err) {
                            that.emit('fatal_error', err);
                        }
                    });
                    this.client.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                        logger.debug(`Connection errored: ${err} - reconnecting`);
                        restart(this);
                    }));
                    this.client.on('close', (reasonCode) => __awaiter(this, void 0, void 0, function* () {
                        logger.info(`Connection closed: ${reasonCode}`);
                        if (!this.closing) {
                            logger.debug('Assuming service was restarted - reconnecting');
                            restart(this);
                        }
                        else {
                            this.closing = false;
                        }
                    }));
                    this.pingInterval = setInterval(() => {
                        let ping = { id: ++this.id, type: 'ping' };
                        this._sendPacket(ping)
                            .then((_response) => { })
                            .catch((err) => {
                            logger.error(`Ping failed ${err}`);
                        });
                    }, this.pingRate);
                    while ((yield this.getConfig()).state != 'RUNNING') {
                        logger.info('Waiting for Home Assistant to signal RUNNING');
                        yield this._wait(1);
                    }
                    resolve();
                }
                catch (err) {
                    logger.fatal(`Connection failed: ${err}`);
                    reject(err);
                }
            }));
        });
    }
    _connect(url) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let client;
                while (true) {
                    try {
                        client = yield this._innerconnect(url);
                        this._authenticate(client)
                            .then(() => resolve(client))
                            .catch((err) => reject(err));
                        break;
                    }
                    catch (err) {
                        if (err instanceof haInterfaceError_1.DNSError) {
                            logger.fatal(`Unable to resolve host address: ${url}`);
                            reject(err);
                            break;
                        }
                        else if (err instanceof haInterfaceError_1.GenericSyscallError) {
                            logger.fatal(`Unhandled syscall error: ${err.syscall}`);
                            reject(err);
                        }
                        else if (err instanceof haInterfaceError_1.ConnectionError) {
                            if (err.code != 'ECONNREFUSED') {
                                logger.fatal(`Unhandled connection error ${err.syscall} - ${err.errno}`);
                                reject(err);
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
                    yield this._wait(1);
                }
            }));
        });
    }
    _innerconnect(url) {
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
    _authenticate(client) {
        return __awaiter(this, void 0, void 0, function* () {
            let ret = new Promise((resolve, reject) => {
                logger.info('Authenticating');
                client.once('message', (message) => {
                    if (typeof message != 'string') {
                        logger.debug('Wrong data type for auth_required');
                        reject(new haInterfaceError_1.WebSocketError('Expected auth_required - received binary packet'));
                    }
                    let msg = JSON.parse(message.toString());
                    if (msg.type != 'auth_required') {
                        logger.debug('Did not get auth_required');
                        reject(new haInterfaceError_1.AuthenticationError(`Expected auth_required - received ${msg.type}`));
                    }
                    client.once('message', (message) => {
                        if (typeof message != 'string') {
                            reject(new haInterfaceError_1.WebSocketError('Expected auth - received binary packet'));
                        }
                        let authResponse = JSON.parse(message.toString());
                        if (authResponse.type != 'auth_ok') {
                            if (authResponse.type == 'auth_invalid') {
                                reject(new haInterfaceError_1.AuthenticationError(authResponse.message));
                            }
                            else {
                                reject(new haInterfaceError_1.AuthenticationError(`Expected an auth response - received ${authResponse.type}`));
                            }
                        }
                        else {
                            logger.info('Authentication is good');
                            resolve();
                        }
                    });
                    let auth = { type: 'auth', access_token: this.accessToken };
                    client.send(JSON.stringify(auth));
                });
            });
            return ret;
        });
    }
    _wait(seconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => setTimeout(resolve, seconds * 1000));
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            let ret = new Promise((resolve, reject) => {
                this.closing = true;
                logger.info('Closing');
                let timer = setTimeout(() => {
                    logger.warn('Failed to close before timeout');
                    reject(new Error('Failed to close connection'));
                }, 5000);
                this.client.once('close', (_reason, _description) => {
                    logger.info('Closed');
                    clearTimeout(timer);
                    resolve();
                });
                this._kill();
                this.client.close(1000);
            });
            return ret;
        });
    }
    get isConnected() {
        return this.connected;
    }
    _kill() {
        this.connected = false;
        clearTimeout(this.pingInterval);
    }
    subscribe() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let packet = { id: ++this.id, type: 'subscribe_events' };
                this._sendPacket(packet)
                    .then((response) => {
                    logger.info('Subscribed to events');
                    resolve(response.result);
                })
                    .catch((err) => {
                    logger.error(`Error subscribing to events: ${err}`);
                    reject(err);
                });
            });
        });
    }
    getStates() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let packet = { id: ++this.id, type: 'get_states' };
                this._sendPacket(packet)
                    .then((response) => {
                    logger.info('States acquired');
                    resolve(response.result);
                })
                    .catch((err) => {
                    logger.error(`Error getting states: ${err}`);
                    reject(err);
                });
            });
        });
    }
    getConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let packet = { id: ++this.id, type: 'get_config' };
                this._sendPacket(packet)
                    .then((response) => {
                    logger.debug('Config acquired');
                    resolve(response.result);
                })
                    .catch((err) => {
                    logger.error(`Error getting config: ${err}`);
                    reject(err);
                });
            });
        });
    }
    getPanels() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let packet = { id: ++this.id, type: 'get_panels' };
                this._sendPacket(packet)
                    .then((response) => {
                    logger.info('Panels acquired');
                    resolve(response.result);
                })
                    .catch((err) => {
                    logger.error(`Error getting panels: ${err}`);
                    reject(err);
                });
            });
        });
    }
    callService(domain, service, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let packet = { id: ++this.id, type: 'call_service', domain: domain, service: service, service_data: data };
                this._sendPacket(packet)
                    .then((response) => {
                    logger.debug('Service call successful');
                    resolve(response.result);
                })
                    .catch((err) => {
                    logger.error(`Error calling service ${err}`);
                    reject(err);
                });
            });
        });
    }
    _sendPacket(packet, handler) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (this.connected == false) {
                    reject(new Error('Connection to server has failed'));
                }
                let timer = setTimeout((packet) => {
                    logger.error(`No reponse received for packet ${JSON.stringify(packet)}`);
                    this.tracker.delete(packet.id);
                    reject(new Error(`No response to ${JSON.stringify(packet)}`));
                }, 10000, packet);
                this.tracker.set(packet.id, {
                    packet: packet,
                    handler: (response) => {
                        clearTimeout(timer);
                        if (handler) {
                            handler(response);
                        }
                        if (response.type == 'pong' || (response.type == 'result' && response.success)) {
                            resolve(response);
                        }
                        else {
                            reject(new Error('Bad response:' + JSON.stringify(response)));
                        }
                    },
                });
                this.client.send(JSON.stringify(packet));
            });
        });
    }
}
exports.HaInterface = HaInterface;
//# sourceMappingURL=index.js.map