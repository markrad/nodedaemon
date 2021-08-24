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
const log4js_1 = require("log4js");
const haInterfaceError_1 = require("../common/haInterfaceError");
const WebSocket = require("ws");
var PacketTypesIn;
(function (PacketTypesIn) {
    PacketTypesIn[PacketTypesIn["ServiceAuthRequired"] = 0] = "ServiceAuthRequired";
    PacketTypesIn[PacketTypesIn["ServiceAuthOk"] = 1] = "ServiceAuthOk";
    PacketTypesIn[PacketTypesIn["ServiceAuthInvalid"] = 2] = "ServiceAuthInvalid";
    PacketTypesIn[PacketTypesIn["ServiceError"] = 3] = "ServiceError";
    PacketTypesIn[PacketTypesIn["ServiceSuccess"] = 4] = "ServiceSuccess";
    PacketTypesIn[PacketTypesIn["ServicePong"] = 5] = "ServicePong";
    PacketTypesIn[PacketTypesIn["ServiceEvent"] = 6] = "ServiceEvent";
})(PacketTypesIn || (PacketTypesIn = {}));
const CATEGORY = 'HaInterface';
var logger = log4js_1.getLogger(CATEGORY);
if (process.env.HAINTERFACE_LOGGING) {
    logger.level = process.env.HAINTERFACE_LOGGING;
}
class HaInterface extends events_1.default {
    constructor(url, accessToken, pingRate = 60000) {
        super();
        this._accessToken = accessToken;
        this._client = null;
        this._url = url;
        this._id = 0;
        this._tracker = new Map();
        this._pingRate = pingRate;
        this._pingInterval = null;
        this._closing = false;
        this._connected = false;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    this._client = yield this._connect(this._url);
                    logger.info(`Connection complete`);
                    this._connected = true;
                    this._client.on('message', (message) => {
                        if (typeof message != 'string') {
                            logger.warn(`Unrecognized message type: ${typeof message}`);
                        }
                        else {
                            // let msg = JSON.parse(message);
                            let msg = this._messageFactory(message);
                            if (msg.name == PacketTypesIn.ServiceEvent) {
                                let msgEvent = msg;
                                logger.trace(`msg.event.event_type=${msgEvent.event.event_type}`);
                                this.emit(msgEvent.event.event_type, msgEvent.event.data);
                                return;
                            }
                            let msgResponse;
                            switch (msg.name) {
                                case PacketTypesIn.ServiceSuccess:
                                    msgResponse = msg;
                                    break;
                                case PacketTypesIn.ServiceError:
                                    msgResponse = msg;
                                    break;
                                case PacketTypesIn.ServicePong:
                                    msgResponse = msg;
                                    break;
                            }
                            try {
                                this._tracker.get(msgResponse.id).handler(msgResponse);
                                this._tracker.delete(msgResponse.id);
                            }
                            catch (err) {
                                logger.fatal('This should never happen. Send packets should always have a response handler');
                            }
                        }
                    });
                    var restart = (that) => __awaiter(this, void 0, void 0, function* () {
                        that._kill();
                        try {
                            yield that.start();
                            that._connected = true;
                            logger.info(`Reconnection complete`);
                            that.emit('reconnected');
                        }
                        catch (err) {
                            that.emit('fatal_error', err);
                        }
                    });
                    this._client.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                        logger.debug(`Connection errored: ${err} - reconnecting`);
                        restart(this);
                    }));
                    this._client.on('close', (reasonCode) => __awaiter(this, void 0, void 0, function* () {
                        logger.info(`Connection closed: ${reasonCode}`);
                        if (!this._closing) {
                            logger.debug('Assuming service was restarted - reconnecting');
                            restart(this);
                        }
                        else {
                            this._closing = false;
                        }
                    }));
                    this._pingInterval = setInterval(() => {
                        let ping = { id: ++this._id, type: 'ping' };
                        this._sendPacket(ping)
                            .then((_response) => { })
                            .catch((err) => {
                            logger.error(`Ping failed ${err}`);
                        });
                    }, this._pingRate);
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
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            let ret = new Promise((resolve, reject) => {
                this._closing = true;
                logger.info('Closing');
                let timer = setTimeout(() => {
                    logger.warn('Failed to close before timeout');
                    reject(new Error('Failed to close connection'));
                }, 5000);
                this._client.once('close', (_reason, _description) => {
                    logger.info('Closed');
                    clearTimeout(timer);
                    resolve();
                });
                this._kill();
                this._client.close(1000);
            });
            return ret;
        });
    }
    get isConnected() {
        return this._connected;
    }
    subscribe() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let packet = { id: ++this._id, type: 'subscribe_events' };
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
                let packet = { id: ++this._id, type: 'get_states' };
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
                let packet = { id: ++this._id, type: 'get_config' };
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
                let packet = { id: ++this._id, type: 'get_panels' };
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
                let packet = { id: ++this._id, type: 'call_service', domain: domain, service: service, service_data: data };
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
    _messageFactory(msgJSON) {
        let msg = JSON.parse(msgJSON);
        switch (msg.type) {
            case "result":
                return msg.success == true
                    ? { name: PacketTypesIn.ServiceSuccess, id: msg.id, type: "result", success: true, result: msg.result }
                    : { name: PacketTypesIn.ServiceError, id: msg.id, type: "result", success: false, error: msg.error };
            case "event":
                return { name: PacketTypesIn.ServiceEvent, type: msg.type, event: msg.event };
            case "pong":
                return { name: PacketTypesIn.ServicePong, id: msg.id, type: "pong" };
            case "auth_ok":
                return { name: PacketTypesIn.ServiceAuthOk, type: msg.type, ha_version: msg.ha_version };
            case "auth_invalid":
                return { name: PacketTypesIn.ServiceAuthInvalid, type: msg.type, message: msg.message };
            default:
                let errMsg = `Unrecognized server response: ${msgJSON}`;
                logger.error(errMsg);
                throw new Error(errMsg);
        }
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
                    let auth = { type: 'auth', access_token: this._accessToken };
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
    _kill() {
        this._connected = false;
        clearTimeout(this._pingInterval);
    }
    _sendPacket(packet, handler) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (this._connected == false) {
                    reject(new Error('Connection to server has failed'));
                }
                let timer = setTimeout((packet) => {
                    logger.error(`No reponse received for packet ${JSON.stringify(packet)}`);
                    this._tracker.delete(packet.id);
                    reject(new Error(`No response to ${JSON.stringify(packet)}`));
                }, 10000, packet);
                this._tracker.set(packet.id, {
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
                this._client.send(JSON.stringify(packet));
            });
        });
    }
}
exports.HaInterface = HaInterface;
//# sourceMappingURL=index.js.map