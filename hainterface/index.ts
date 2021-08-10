"use strict";

import EventEmitter from 'events';
const WebSock = require('ws'); //  { WebSocket } from 'ws';
import { getLogger } from 'log4js';
// var log4js = require('log4js');

import { ErrorFactory, ConnectionError, DNSError, GenericSyscallError, WebSocketError, AuthenticationError } from '../common/haInterfaceError';
import { BlobOptions } from 'buffer';
import { AnyARecord } from 'dns';
import { ServiceTarget } from '../haitems/haparentitem';

type ServiceAuthRequired = {
    type: "auth_required",
    ha_version: "string",
}

type ServiceAuthOk = {
    type: "auth_ok",
    ha_version: "string",
}

type ServiceAuthInvalid = {
    type: "auth_invalid",
    message: "string",
}

type ServiceErrorDetails = {
    code: string,
    message: string;
}
type ServiceError = {
    id: number,
    type: "result",
    "success": false,
    error: ServiceErrorDetails,
}

const CATEGORY = 'HaInterface';

var logger = getLogger(CATEGORY);

if (process.env.HAINTERFACE_LOGGING) {
    logger.level = process.env.HAINTERFACE_LOGGING;
}

class HaInterface extends EventEmitter {
    accessToken: string;
    client: any;
    url: string;
    id: number;
    tracker: any;           // TODO
    pingRate: number;
    pingInterval: NodeJS.Timer;
    closing: boolean;
    connected: boolean;
    constructor(url: string, accessToken: string, pingRate: number) {
        super();
        this.accessToken = accessToken;
        this.client = null;
        this.url = url;
        this.id = 0;
        this.tracker = {};
        this.pingRate = pingRate || 60000;
        this.pingInterval = null;
        this.closing = false;
        this.connected = false;
    }

    async start(): Promise<void> {
        let ret = new Promise<void>(async (resolve, reject): Promise<any> => {        // TODO?
            try {
                this.client = await this._connect(this.url);
                logger.info(`Connection complete`);
                this.connected = true;

                this.client.on('message', (message) => {
                    if (typeof message != 'string') {
                        logger.warn(`Unrecognized message type: ${typeof message}`);
                    }
                    else {
                        let msg = JSON.parse(message);
        
                        if (msg.type == 'pong' || msg.type == 'result') {
                            if (msg.type != 'pong') {
                                logger.trace(`Received:\n${JSON.stringify(JSON.parse(message), null, 2)}`);
                            }

                            if (msg.id in this.tracker) {
                                this.tracker[msg.id].handler(msg);
                                delete this.tracker[msg.id];
                            }
                        }
                        else if (msg.type == 'event') {
                            logger.trace(`msg.event.event_type=${msg.event.event_type}`);
                            this.emit(msg.event.event_type, msg.event.data);
                        }
                        else {
                            logger.warn(`Unknown message: ${msg}`);
                        }
                    }
                });

                var restart = async (that) => {
                    that._kill();
                    
                    try {
                        await that.start();
                        that.connected = true;
                        logger.info(`Reconnection complete`);
                        that.emit('reconnected');
                    }
                    catch (err) {
                        that.emit('fatal_error', err);
                    }
                }

                this.client.on('error', async (err) => {
                    logger.debug(`Connection errored: ${err} - reconnecting`);
                    restart(this);
                });

                this.client.on('close', async (reasonCode) => {
                    logger.info(`Connection closed: ${reasonCode}`);

                    if (!this.closing) {
                        logger.debug('Assuming service was restarted - reconnecting');
                        restart(this);
                    }
                    else {
                        this.closing = false;
                    }
                });

                this.pingInterval = setInterval(() => {
                    let ping = { id: ++this.id, type: 'ping' };
                    this._sendPacket(ping, null)
                        .then((_response) => {})
                        .catch((err) => {
                            logger.error(`Ping failed ${err}`);
                        });
                }, this.pingRate);

                while ((await this.getConfig()).state != 'RUNNING') {
                    logger.info('Waiting for Home Assistant to signal RUNNING');
                    await this._wait(1);
                }

                resolve();
            }
            catch (err) {
                logger.fatal(`Connection failed: ${err}`);
                reject(err);
            }
        });

        return ret;
    }

    async _connect(url) {

        return new Promise(async (resolve, reject) => {
            var client;

            while (true) {
                try {
                    client = await this._innerconnect(url);
                    this._authenticate(client)
                        .then(() => resolve(client))
                        .catch((err) => reject(err));
                    break;
                }
                catch (err) {
                    if (err instanceof DNSError) {
                        logger.fatal(`Unable to resolve host address: ${url}`);
                        reject(err);
                        break;
                    }
                    else if (err instanceof GenericSyscallError) {
                        logger.fatal(`Unhandled syscall error: ${err.syscall}`);
                        reject(err);
                    }
                    else if (err instanceof ConnectionError) {
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
                
                await this._wait(1);
            }
        });
    }

    async _innerconnect(url) {
        return new Promise((resolve, reject) => {
            var client = new WebSock(url);
            var connectFailed = (err) => {
                client.off('connected', connectSucceeded);
                reject(ErrorFactory(err));
            };

            var connectSucceeded = () => {
                client.off('connectFailed', connectFailed);
                resolve(client);
            };
            client.once('open', connectSucceeded);
            client.once('error', connectFailed);
        });
    }

    async _authenticate(client): Promise<void> {
        let ret = new Promise<void>((resolve, reject) => {
            logger.info('Authenticating');

            client.once('message', (message) => {
                if (typeof message != 'string') {
                    logger.debug('Wrong data type for auth_required');
                    reject(new WebSocketError('Expected auth_required - received binary packet'));
                }

                let msg = JSON.parse(message);

                if (msg.type != 'auth_required') {
                    logger.debug('Did not get auth_required');
                    reject(new AuthenticationError(`Expected auth_required - received ${msg.type}`));
                }

                client.once('message', (message) => {
                    if (typeof message != 'string') {
                        reject(new WebSocketError('Expected auth - received binary packet'));
                    }

                    let authResponse = JSON.parse(message);

                    if (authResponse.type != 'auth_ok') {
                        if (authResponse.type == 'auth_invalid') {
                            reject(new AuthenticationError(authResponse.message));
                        }
                        else {
                            reject(new AuthenticationError(`Expected an auth response - received ${authResponse.type}`));
                        }
                    }
                    else {
                        logger.info('Authentication is good');
                        resolve();
                    }
                });

                let auth = { type: 'auth', access_token: this.accessToken };
                //logger.debug(`Sending auth \n${JSON.stringify(auth, null, 2)}`);
                client.send(JSON.stringify(auth));
            });
        });

        return ret;
    }

    async _wait(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async stop(): Promise<void> {
        let ret = new Promise<void>((resolve, reject) => {
            this.closing = true;
            logger.info('Closing');

            let timer = setTimeout(() => {
                logger.warn('Failed to close before timeout')
                reject(new Error('Failed to close connection'));
            }, 5000);
            this.client.once('close', (reason, description) => {
                logger.info('Closed');
                clearTimeout(timer);
                resolve();
            });
            this._kill();
            this.client.close(1000);
        });

        return ret;
    }

    get isConnected() {
        return this.connected;
    }

    _kill() {
        this.connected = false;
        clearTimeout(this.pingInterval);
    }

    async subscribe() {
        return new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'subscribe_events' };
            this._sendPacket(packet, null)
                .then((response: any) => {
                    logger.info('Subscribed to events');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error subscribing to events: ${err}`);
                    reject(err);
                });
        });
    }

    async getStates() {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'get_states' };
            this._sendPacket(packet, null)
                .then((response: any) => {
                    logger.info('States acquired');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error getting states: ${err}`);
                    reject(err);
                });
        });

        return ret;
    }

    async getConfig(): Promise<any> {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'get_config' };
            this._sendPacket(packet, null)
                .then((response: any) => {
                    logger.debug('Config acquired');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error getting config: ${err}`);
                    reject(err);
                });
        });

        return ret;
    }

    async getPanels() {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'get_panels' };
            this._sendPacket(packet, null)
                .then((response: any) => {
                    logger.info('Panels acquired');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error getting panels: ${err}`);
                    reject(err);
                });
        });

        return ret;
    }

    async callService(domain: string, service: string, data: ServiceTarget): Promise<any> {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'call_service', domain: domain, service: service, service_data: data };
            this._sendPacket(packet, null)
                .then((response: any) => {
                    logger.debug('Service call successful');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error calling service ${err}`);
                    reject(err);
                });
        });

        return ret;
    }

    async _sendPacket(packet, handler) {
        let ret = new Promise((resolve, reject) => {
            if (this.connected == false) {
                reject(new Error('Connection to server has failed'));
            }
            let timer = setTimeout((packet) => {
                logger.error(`No reponse received for packet ${JSON.stringify(packet)}`);
                delete this.tracker[packet.id];
                reject(new Error(`No response to ${JSON.stringify(packet)}`));
            }, 10000, packet);
            this.tracker[packet.id] = {
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
            };
            this.client.send(JSON.stringify(packet));
        });

        return ret;
    }
}

module.exports = HaInterface;