"use strict";

import EventEmitter from 'events';
import { getLogger } from 'log4js';
import { AuthenticationError, /*ConnectionError, DNSError, ErrorFactory, GenericSyscallError,*/ WebSocketError } from '../common/haInterfaceError';
import { ServiceTarget } from '../haitems/haparentitem';
// import WebSocket = require('ws');
import { WSWrapper } from '../common/wswrapper';
import { EventWaiter } from '../common/eventwaiter';

enum PacketTypesIn {
    ServiceAuthRequired,
    ServiceAuthOk,
    ServiceAuthInvalid,
    ServiceError,
    ServiceSuccess,
    ServicePong,
    ServiceEvent,
}
interface ServiceParent {
    type: string;
    name: PacketTypesIn;
}
interface ServiceAuthRequired extends ServiceParent {
    type: "auth_required";
    ha_version: "string";
}

interface ServiceAuthOk extends ServiceParent {
    type: "auth_ok";
    ha_version: "string";
}

interface ServiceAuthInvalid extends ServiceParent{
    type: "auth_invalid";
    message: "string";
}

interface ServiceErrorDetails {
    code: string;
    message: string;
}

interface ServiceError extends ServiceParent {
    id: number;
    type: "result";
    "success": false;
    error: ServiceErrorDetails;
}

interface ServiceSuccess extends ServiceParent {
    id: number;
    type: "result";
    success: true;
    result: any;
}

interface ServiceEvent extends ServiceParent {
    id: number;
    type: "event";
    event: any;
}

interface ServicePong extends ServiceParent {
    id: number;
    type: "pong";
}

interface ServiceAuth extends ServiceParent {
    type: "auth";
    access_token: string;
}

const CATEGORY = 'HaInterface';

var logger = getLogger(CATEGORY);

if (process.env.HAINTERFACE_LOGGING) {
    logger.level = process.env.HAINTERFACE_LOGGING;
}

export class HaInterface extends EventEmitter {
    private _accessToken: string;
    private _client: WSWrapper;
    private _url: string;
    private _id: number;
    private _tracker: Map<number, any>;
    private _pingRate: number;
    private _pingInterval: NodeJS.Timer;
    private _closing: boolean;
    private _connected: boolean;
    private _waitAuth: EventWaiter;
    public constructor(url: string, accessToken: string, pingRate: number = 60000) {
        super();
        this._accessToken = accessToken;
        this._client = null;
        this._url = url;
        this._id = 0;
        this._tracker = new Map<number, any>();
        this._pingRate = pingRate;
        this._pingInterval = null;
        this._closing = false;
        this._connected = false;
        this._waitAuth = new EventWaiter();
    }

    public async start(): Promise<void> {
        return new Promise<void>(async (resolve, reject): Promise<void> => {    
            try {
                this._client = new WSWrapper(this._url, 60)

                this._client.on('message', async (message: string) => {
                    if (typeof message != 'string') {
                        logger.warn(`Unrecognized message type: ${typeof message}`);
                    }
                    else {
                        // let msg = JSON.parse(message);
                        let msg: ServiceParent = this._messageFactory(message);

                        if (msg.name == PacketTypesIn.ServiceEvent) {
                            let msgEvent = msg as ServiceEvent;
                            logger.trace(`msg.event.event_type=${msgEvent.event.event_type}`);
                            this.emit(msgEvent.event.event_type, msgEvent.event.data);
                            return;
                        }
                        
                        let msgResponse: ServiceSuccess | ServiceError | ServicePong;

                        switch (msg.name) {
                            case PacketTypesIn.ServiceAuthRequired:
                                await this._authenticate();
                                break;
                            case PacketTypesIn.ServiceSuccess:
                                msgResponse = msg as ServiceSuccess;
                                break;
                            case PacketTypesIn.ServiceError:
                                msgResponse = msg as ServiceError;
                                break;
                            case PacketTypesIn.ServicePong:
                                msgResponse = msg as ServicePong;
                                break;
                        }

                        if (msgResponse) {
                            try {
                                this._tracker.get(msgResponse.id).handler(msgResponse);
                                this._tracker.delete(msgResponse.id);
                            }
                            catch (err: any) {
                                logger.fatal('This should never happen. Send packets should always have a response handler');
                            }
                        }
                    }
                });

                await this._client.open();
                logger.info(`Connection complete`);
                this._connected = true;
                // await this._authenticate();

                var restart = async (that: HaInterface) => {
                    that._kill();
                    
                    try {
                        await that.start();
                        that._connected = true;
                        logger.info(`Reconnection complete`);
                        that.emit('reconnected');
                    }
                    catch (err) {
                        that.emit('fatal_error', err);
                    }
                }

                this._client.on('error', async (err: Error) => {
                    logger.debug(`Connection errored: ${err} - reconnecting`);
                    restart(this);
                });

                this._client.on('close', async (reasonCode: Number) => {
                    logger.info(`Connection closed: ${reasonCode}`);

                    if (!this._closing) {
                        logger.debug('Assuming service was restarted - reconnecting');
                        restart(this);
                    }
                    else {
                        this._closing = false;
                    }
                });

                this._pingInterval = setInterval(() => {
                    let ping = { id: ++this._id, type: 'ping' };
                    this._sendPacket(ping)
                        .then((_response) => {})
                        .catch((err) => {
                            logger.error(`Ping failed ${err}`);
                        });
                }, this._pingRate);

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
    }

    public async stop(): Promise<void> {
        let ret = new Promise<void>((resolve, reject) => {
            this._closing = true;
            logger.info('Closing');

            let timer = setTimeout(() => {
                logger.warn('Failed to close before timeout')
                reject(new Error('Failed to close connection'));
            }, 5000);
            this._client.once('close', (_reason, _description) => {
                logger.info('Closed');
                clearTimeout(timer);
                resolve();
            });
            this._kill();
            this._client.close();
        });

        return ret;
    }

    public get isConnected() {
        return this._connected;
    }

    public async subscribe() {
        return new Promise((resolve, reject) => {
            let packet = { id: ++this._id, type: 'subscribe_events' };
            this._sendPacket(packet)
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

    public async getStates(): Promise<any []> {
        return new Promise<any []>((resolve, reject) => {
            let packet = { id: ++this._id, type: 'get_states' };
            this._sendPacket(packet)
                .then((response: any) => {
                    logger.info('States acquired');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error getting states: ${err}`);
                    reject(err);
                });
        });
    }

    public async getConfig(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let packet = { id: ++this._id, type: 'get_config' };
            this._sendPacket(packet)
                .then((response: any) => {
                    logger.debug('Config acquired');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error getting config: ${err}`);
                    reject(err);
                });
        });
    }

    public async getPanels(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let packet = { id: ++this._id, type: 'get_panels' };
            this._sendPacket(packet)
                .then((response: any) => {
                    logger.info('Panels acquired');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error getting panels: ${err}`);
                    reject(err);
                });
        });
    }

    public async callService(domain: string, service: string, data: ServiceTarget): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let packet = { id: ++this._id, type: 'call_service', domain: domain, service: service, service_data: data };
            this._sendPacket(packet)
                .then((response: any) => {
                    logger.debug('Service call successful');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error calling service ${err}`);
                    reject(err);
                });
        });
    }

    private _messageFactory(msgJSON: string): ServiceAuthOk | ServiceAuthRequired | ServiceAuthInvalid | ServiceError | ServicePong | ServiceSuccess | ServiceEvent {
        let msg: any = JSON.parse(msgJSON);

        switch (msg.type) {
            case "auth_required":
                return <ServiceAuthRequired> { name: PacketTypesIn.ServiceAuthRequired, type: msg.type, ha_version: msg.ha_version };
            case "result":
                return msg.success == true 
                    ? <ServiceSuccess> { name: PacketTypesIn.ServiceSuccess, id: msg.id, type: "result", success: true, result: msg.result }
                    : <ServiceError> { name: PacketTypesIn.ServiceError, id: msg.id, type: "result", success: false, error: <ServiceErrorDetails> msg.error };
            case "event":
                return <ServiceEvent> { name: PacketTypesIn.ServiceEvent, type: msg.type, event: msg.event };
            case "pong":
                return <ServicePong> { name: PacketTypesIn.ServicePong, id: msg.id, type: "pong" };
            case "auth_ok":
                return <ServiceAuthOk> { name: PacketTypesIn.ServiceAuthOk, type: msg.type, ha_version: msg.ha_version };
            case "auth_invalid":
                return <ServiceAuthInvalid> { name: PacketTypesIn.ServiceAuthInvalid, type: msg.type, message: msg.message };
            default:
                let errMsg = `Unrecognized server response: ${msgJSON}`;
                logger.error(errMsg);
                throw new Error(errMsg);
        }
    }
/*
    private async _connect(url: string): Promise<WebSocket> {
        return new Promise(async (resolve, reject) => {
            let client: WebSocket;

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

    private async _innerconnect(url: string): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            var client = new WebSocket(url);
            var connectFailed = (err: Error) => {
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
*/
    private async _authenticate(): Promise<void> {
        let ret = new Promise<void>((resolve, reject) => {
            logger.info('Authenticating');

            this._client.once('message', (message) => {
                if (typeof message != 'string') {
                    logger.debug('Wrong data type for auth_required');
                    reject(new WebSocketError('Expected auth_required - received binary packet'));
                }

                let msg = JSON.parse(message.toString());

                if (msg.type != 'auth_required') {
                    logger.debug('Did not get auth_required');
                    reject(new AuthenticationError(`Expected auth_required - received ${msg.type}`));
                }

                this._client.once('message', (message) => {
                    if (typeof message != 'string') {
                        reject(new WebSocketError('Expected auth - received binary packet'));
                    }

                    let authResponse = JSON.parse(message.toString());

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

                let auth = <ServiceAuth> { type: 'auth', access_token: this._accessToken };
                this._client.send(JSON.stringify(auth));
            });
        });

        return ret;
    }

    private async _wait(seconds: number) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    private _kill() {
        this._connected = false;
        clearTimeout(this._pingInterval);
    }

    private async _waitAuthenticated(): Promise<void> {
        return new Promise<void>((resolve, _reject) => {
            if (this._waitAuth.EventIsResolved) {
                resolve();
            }
            else {
                this._waitAuth.EventWait()
                .then(() => resolve());
            }
        })
    }

    private async _sendPacket(packet: any, handler?:Function): Promise<ServiceSuccess | ServiceError | ServicePong> {
        return new Promise<ServiceSuccess | ServiceError | ServicePong>(async (resolve, reject) => {
            if (this._connected == false) {
                reject(new Error('Connection to server has failed'));
            }
            await this._waitAuthenticated();
            let timer = setTimeout((packet) => {
                logger.error(`No reponse received for packet ${JSON.stringify(packet)}`);
                this._tracker.delete(packet.id);
                reject(new Error(`No response to ${JSON.stringify(packet)}`));
            }, 10000, packet);
            this._tracker.set(packet.id, {
                packet: packet,
                handler: (response: ServiceSuccess | ServiceError | ServicePong) => {
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
    }
}
