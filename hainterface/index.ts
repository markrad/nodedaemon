"use strict";

import EventEmitter from 'events';
import { getLogger } from 'log4js';
import { ServiceTarget } from '../haitems/haparentitem';
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

class AuthenticationError extends Error {
    public constructor(message: string) {
        super(message);
    }
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
                this._client = new WSWrapper(this._url, 0)

                this._client.on('message', async (message: string) => {
                    if (typeof message != 'string') {
                        logger.warn(`Unrecognized message type: ${typeof message}`);
                    }
                    else {
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
                                logger.info('Authenticating');
                                let auth = <ServiceAuth> { type: 'auth', access_token: this._accessToken };
                                this._client.send(JSON.stringify(auth));
                                break;
                            case PacketTypesIn.ServiceAuthOk:
                                logger.info('Authentication successful');
                                this._waitAuth.EventSet();
                                this._waitAuth.EventReset()
                                break;
                            case PacketTypesIn.ServiceAuthInvalid:
                                logger.fatal(`Authentication failed: ${(msg as ServiceAuthInvalid).message}`);
                                throw new AuthenticationError((msg as ServiceAuthInvalid).message);
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

    public get isAuthenticated() {
        return this._waitAuth.EventIsResolved;
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
