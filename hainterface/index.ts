"use strict";

import EventEmitter from 'events';
import { getLogger, Level } from 'log4js';
import { ServiceTarget } from '../haitems/haparentitem';
import { WSWrapper } from '../common/wswrapper';
import { EventWaiter } from '../common/eventwaiter';
import http from 'http';
import https from 'https';
import { IHaItem } from '../haitems/ihaitem';

enum PacketTypesIn {
    ServiceAuthRequired,
    ServiceAuthOk,
    ServiceAuthInvalid,
    ServiceError,
    ServiceSuccess,
    ServicePong,
    ServiceEvent,
}
interface IServiceParent {
    type: string;
    name: PacketTypesIn;
}
interface IServiceAuthRequired extends IServiceParent {
    type: "auth_required";
    ha_version: "string";
}

interface IServiceAuthOk extends IServiceParent {
    type: "auth_ok";
    ha_version: "string";
}

interface IServiceAuthInvalid extends IServiceParent{
    type: "auth_invalid";
    message: "string";
}

interface IServiceErrorDetails {
    code: string;
    message: string;
}

interface IServiceError extends IServiceParent {
    id: number;
    type: "result";
    "success": false;
    error: IServiceErrorDetails;
}

interface IServiceSuccess extends IServiceParent {
    id: number;
    type: "result";
    success: true;
    result: any;
}

interface IServiceEvent extends IServiceParent {
    id: number;
    type: "event";
    event: any;
}

interface IServicePong extends IServiceParent {
    id: number;
    type: "pong";
}

interface IServiceAuth extends IServiceParent {
    type: "auth";
    access_token: string;
}

interface IOutPacket {
    id: number;
    type: string;
}

class AuthenticationError extends Error {
    public constructor(message: string) {
        super(message);
    }
}

const CATEGORY = 'HaInterface';

var logger = getLogger(CATEGORY);

export interface IHaInterfaceEvents {
    'serviceevent': (eventType: any, data: any) => void;
    'connected': () => void;
    'disconnected': () => void;
};

export declare interface HaInterface {
    on<U extends keyof IHaInterfaceEvents>(event: U, listner: IHaInterfaceEvents[U]): this;
    emit<U extends keyof IHaInterfaceEvents>(event: U, ...args: Parameters<IHaInterfaceEvents[U]>): boolean;
}

export class HaInterface extends EventEmitter {
    private static readonly APIPATH = '/api/websocket';
    private static readonly RESTPATH = '/api';
    private _accessToken: string;
    private _client: WSWrapper = null;
    private _restProtocol: typeof http | typeof https;
    private _protocol: string = null;
    private _hostname: string;
    private _port: number;
    private _id: number = 0;
    private _tracker: Map<number, any> = new Map<number, any>();
    private _pingInterval: number;
    private _connected: boolean = false;
    private _running: boolean = false;
    private _waitAuth: EventWaiter = new EventWaiter();
    public constructor(useTLS: boolean, hostname: string, port: number,  accessToken: string, pingInterval: number = 30) {
        super();
        this._accessToken = accessToken;
        this._protocol = useTLS? 'wss://' : 'ws://';
        this._restProtocol = useTLS? https : http;
        this._hostname = hostname;
        this._port = port;
        this._pingInterval = pingInterval;

        if (process.env.HAINTERFACE_LOGGING) {
            logger.level = process.env.HAINTERFACE_LOGGING;
            logger.log(logger.level, 'Logging level overridden');
        }
    }

    public async start(): Promise<void> {
        return new Promise<void>(async (resolve, reject): Promise<void> => {    
            try {
                this._client = new WSWrapper(`${this._protocol}${this._hostname}:${this._port}${HaInterface.APIPATH}`, this._pingInterval, logger.level as Level);
                logger.info(`Connecting to ${this._client.url}`);

                this._client.on('message', async (message: string) => {
                    if (typeof message != 'string') {
                        logger.warn(`Unrecognized message type: ${typeof message}`);
                    }
                    else {
                        let msg: IServiceParent = this._messageFactory(message);

                        if (msg.name == PacketTypesIn.ServiceEvent) {
                            let msgEvent = msg as IServiceEvent;
                            logger.trace(`msg.event.event_type=${msgEvent.event.event_type};entity=${msgEvent.event.data.entity_id}`);
                            this.emit('serviceevent', msgEvent.event.event_type, msgEvent.event.data);
                            return;
                        }
                        
                        let msgResponse: IServiceSuccess | IServiceError | IServicePong;

                        switch (msg.name) {
                            case PacketTypesIn.ServiceAuthRequired:
                                logger.info('Authenticating');
                                let auth = <IServiceAuth> { type: 'auth', access_token: this._accessToken };
                                this._client.send(JSON.stringify(auth));
                                break;
                            case PacketTypesIn.ServiceAuthOk:
                                logger.info('Authentication successful');
                                this._waitAuth.EventSet();
                                break;
                            case PacketTypesIn.ServiceAuthInvalid:
                                logger.fatal(`Authentication failed: ${(msg as IServiceAuthInvalid).message}`);
                                throw new AuthenticationError((msg as IServiceAuthInvalid).message);
                            case PacketTypesIn.ServiceSuccess:
                                msgResponse = msg as IServiceSuccess;
                                break;
                            case PacketTypesIn.ServiceError:
                                msgResponse = msg as IServiceError;
                                break;
                            case PacketTypesIn.ServicePong:
                                msgResponse = msg as IServicePong;
                                break;
                        }

                        if (msgResponse) {
                            try {
                                logger.trace(`Response to id=${msgResponse?.id ?? "none"};type=${msgResponse?.type ?? 'none'}${msgResponse?.type == 'result'? ";success=" + msgResponse.success : ''}`);
                                this._tracker.get(msgResponse.id).handler(msgResponse);
                                this._tracker.delete(msgResponse.id);
                            }
                            catch (err: any) {
                                logger.error('Message received with no response handler - probably timed out waiting for it');
                            }
                        }
                    }
                });
                this._client.on('connected', (): void => {
                    this._waitAuth.EventReset()
                    this._connected = true;
                    this.emit('connected');
                });

                this._client.on('disconnected', (): void => {
                    this._kill();
                    this.emit('disconnected');
                });

                await this._client.open();
                logger.info(`Connection complete`);
                resolve();
            }
            catch (err) {
                logger.fatal(`Connection failed: ${err}`);
                reject(err);
            }
        });
    }

    public async stop(): Promise<void> {
        return new Promise<void>((resolve, _reject) => {
            logger.info('Closing');

            // let timer = setTimeout(() => {
            //     logger.warn('Failed to close before timeout')
            //     reject(new Error('Failed to close connection'));
            // }, 500000000);
            // this._client.once('close', (_reason, _description) => {
            //     logger.info('Closed');
            //     clearTimeout(timer);
            //     resolve();
            // });
            this._kill();
            this._client.close();
            logger.info('Closed');
            resolve();
        });
    }

    public get isConnected() {
        return this._connected;
    }

    public get isAuthenticated() {
        return this._waitAuth.EventIsResolved;
    }

    public get isHaRunning() {
        return this._running;
    }

    private _makePacket(packetType: string): IOutPacket {
        let packet: IOutPacket = { id: ++this._id, type: packetType };
        logger.trace(`id=${packet.id};type=${packet.type}`);
        return packet;
    }

    public async subscribe() {
        return new Promise(async (resolve, reject) => {
            //await this._waitHaRunning();
            await this._waitAuthenticated();
            this._sendPacket(this._makePacket('subscribe_events'))
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
        return new Promise<any []>(async (resolve, reject) => {
            await this._waitHaRunning();
            this._sendPacket(this._makePacket('get_states'))
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
        return new Promise<any>(async (resolve, reject) => {
            this._sendPacket(this._makePacket('get_config'))
                .then((response: any) => {
                    logger.debug('Config acquired');
                    this._running = 'RUNNING' == response.result.state;
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error getting config: ${err}`);
                    reject(err);
                });
        });
    }

    public async getPanels(): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            await this._waitHaRunning();
            this._sendPacket(this._makePacket('get_panels'))
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

    private _getrestparms(entityId: string, value: boolean | string | number, newEntity: boolean ): { body: any, options: any } {
        const body: any = {
            state: value,
            attributes: {}
        }

        if (newEntity) {
            body.attributes.addedBy = 'nodedaemon';
        }
        const options: any = {
            hostname: this._hostname,
            port: this._port.toString(),
            path: `${HaInterface.RESTPATH}/states/${entityId}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'authorization': `Bearer ${this._accessToken}`
            }
        };

        return { body: body, options: options };
    }

    public async addSensor(entityId: string, value: boolean | string | number, attributes?: object): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            const parameters = this._getrestparms(entityId, value, true);

            if (attributes) {
                parameters.body.attributes = { ...parameters.body.attributes, ...attributes };
            }

            const req = this._restProtocol.request(parameters.options, (res) => {
                if (res.statusCode != 201) {
                    reject(new Error(`Add sensor failed with ${res.statusCode}`));
                }
                else {
                    resolve();
                }
            });

            req.on('error', (e) => reject(e));
            req.write(JSON.stringify(parameters.body));
            req.end();
        });
    }

    public async updateSensor(entityId: IHaItem, value: boolean | string | number, forceUpdate: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const parameters = this._getrestparms(entityId.entityId, value, false);

            parameters.body.attributes = { ...parameters.body.attributes, ...entityId.attributes };

            if (forceUpdate) {
                parameters.body.attributes = { ...parameters.body.attributes, ...{ forcedUpdateAt: (new Date().toISOString()) } };
            }

            const req = this._restProtocol.request(parameters.options, (res) => {
                if (res.statusCode != 200) {
                    reject(new Error(`Update sensor failed with ${res.statusCode}`));
                }
                else {
                    resolve();
                }
            });

            req.on('error', (e) => reject(e));
            req.write(JSON.stringify(parameters.body));
            req.end();
        });
    }

    private _messageFactory(msgJSON: string): IServiceAuthOk | IServiceAuthRequired | IServiceAuthInvalid | IServiceError | IServicePong | IServiceSuccess | IServiceEvent {
        let msg: any = JSON.parse(msgJSON);

        switch (msg.type) {
            case "auth_required":
                return <IServiceAuthRequired> { name: PacketTypesIn.ServiceAuthRequired, type: msg.type, ha_version: msg.ha_version };
            case "result":
                return msg.success == true 
                    ? <IServiceSuccess> { name: PacketTypesIn.ServiceSuccess, id: msg.id, type: "result", success: true, result: msg.result }
                    : <IServiceError> { name: PacketTypesIn.ServiceError, id: msg.id, type: "result", success: false, error: <IServiceErrorDetails> msg.error };
            case "event":
                return <IServiceEvent> { name: PacketTypesIn.ServiceEvent, type: msg.type, event: msg.event };
            case "pong":
                return <IServicePong> { name: PacketTypesIn.ServicePong, id: msg.id, type: "pong" };
            case "auth_ok":
                return <IServiceAuthOk> { name: PacketTypesIn.ServiceAuthOk, type: msg.type, ha_version: msg.ha_version };
            case "auth_invalid":
                return <IServiceAuthInvalid> { name: PacketTypesIn.ServiceAuthInvalid, type: msg.type, message: msg.message };
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
        this._running = false;
        // clearTimeout(this._pingInterval);
    }

    private async _waitAuthenticated(): Promise<void> {
        return new Promise<void>((resolve, _reject) => {
            this._waitAuth.EventWait()
            .then(() => {
                resolve()
            });
        })
    }

    private async _waitHaRunning(): Promise<void> {
        return new Promise<void>(async (resolve, _reject) => {
            if (this._running) {
                resolve();
            }
            else {
                while ('RUNNING' != (await this.getConfig()).state) {
                    try {
                        logger.info('Waiting for HA to signal RUNNING');
                        await this._wait(3);
                    }
                    catch (err) {
                        logger.warn(`Failed to get config - will delay ten seconds`);
                        await this._wait(10);
                    }
                }

                resolve();
            }
        });
    }

    private async _sendPacket(packet: IOutPacket, handler?:Function): Promise<IServiceSuccess | IServiceError | IServicePong> {
        return new Promise<IServiceSuccess | IServiceError | IServicePong>(async (resolve, reject) => {
            await this._waitAuthenticated();
            logger.trace(`Sending packet id=${packet.id};type=${packet?.type || 'none'}`);
            let timer = setTimeout((packet) => {
                logger.error(`No reponse received for packet ${JSON.stringify(packet)}`);
                this._tracker.delete(packet.id);
                reject(new Error(`No response to ${JSON.stringify(packet)}`));
            }, 10000, packet);
            this._tracker.set(packet.id, {
                packet: packet,
                handler: (response: IServiceSuccess | IServiceError | IServicePong) => {
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
