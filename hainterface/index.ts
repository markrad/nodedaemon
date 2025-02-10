"use strict";

import EventEmitter from 'events';
import { getLogger } from 'log4js';
import { ServiceTarget } from '../haitems/haparentitem';
import { WSWrapper, WSWrapperOptions } from '../common/wswrapper';
import { EventWaiter } from '../common/eventwaiter';
import http from 'http';
import https from 'https';
import { IHaItem } from '../haitems/ihaitem';
import { PacketTracker } from './packetTracker';
import { IServiceParent } from './IServiceParent';
import { IServiceAuthRequired } from './IServiceAuthRequired';
import { IServiceAuthOk } from './IServiceAuthOk';
import { IServiceAuthInvalid } from './IServiceAuthInvalid';
import { IServiceErrorDetails } from './IServiceErrorDetails';
import { IServiceError } from './IServiceError';
import { IServiceSuccess } from './IServiceSuccess';
import { IServiceEvent } from './IServiceEvent';
import { IServicePong } from './IServicePong';
import { IServiceAuth } from './IServiceAuth';
import { IOutPacket } from './IOutPacket';
import { AuthenticationError } from './AuthenticationError';
import { PacketTypesIn } from './PacketTypesIn';

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
    private static readonly API__PATH = '/api/websocket';
    private static readonly REST_PATH = '/api';
    private _accessToken: string;
    private _client: WSWrapper = null;
    private _restProtocol: typeof http | typeof https;
    private _protocol: string = null;
    private _hostname: string;
    private _port: number;
    private _proxy: string | URL;
    private _id: number = 0;
    private _pingInterval: number;
    private _connected: boolean = false;
    // private _running: boolean = false;
    private _waitAuth: EventWaiter = new EventWaiter();
    private _packetTracker: PacketTracker = new PacketTracker();
    /**
     * Constructs a new instance of the `Hainterface` class.
     * 
     * @param useTLS - Specifies whether to use TLS for the connection.
     * @param hostname - The hostname of the server to connect to.
     * @param port - The port number of the server to connect to.
     * @param accessToken - The access token for authentication.
     * @param proxy - The proxy URL for the connection (optional).
     * @param pingInterval - The interval (in seconds) for sending ping messages (default: 30).
     */
    public constructor(useTLS: boolean, hostname: string, port: number,  accessToken: string, proxy: string | URL = null, pingInterval: number = 30) {
        super();
        this._accessToken = accessToken;
        this._protocol = useTLS? 'wss://' : 'ws://';
        this._restProtocol = useTLS? https : http;
        this._hostname = hostname;
        this._port = port;
        this._proxy = proxy;
        this._pingInterval = pingInterval;

        if (process.env.HAINTERFACE_LOGGING) {
            logger.level = process.env.HAINTERFACE_LOGGING;
            logger.log(logger.level, `Logging level overridden: ${logger.level}`);
        }
    }

    /**
     * Starts the connection to the server.
     * 
     * @returns A promise that resolves when the connection is successfully established, or rejects with an error if the connection fails.
     */
    public async start(): Promise<void> {
        return new Promise<void>(async (resolve, reject): Promise<void> => {    
            try {
                let options: WSWrapperOptions = {
                    url: this._protocol + this._hostname + ':' + this._port.toString() + HaInterface.API__PATH,
                    proxyUrl: this._proxy,
                    pingInterval: this._pingInterval,
                    level: process.env.WSWRAPPER_LOGGING? process.env.WSWRAPPER_LOGGING : logger.level
                };
                this._client = new WSWrapper(options);
                logger.info(`Connecting to ${this._client.url}`);

                this._client.on('message', async (message: string | Buffer) => {
                    if (typeof message != 'string' && !Buffer.isBuffer(message)) {
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
                                this._packetTracker.deliverResponse(msgResponse.id, msgResponse);
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

    /**
     * Stops the operation of the interface.
     * 
     * @returns A promise that resolves when the interface has stopped.
     */
    public async stop(): Promise<void> {
        return new Promise<void>(async (resolve, _reject) => {
            logger.info('Closing');
            this._kill();
            this._packetTracker.cleanup();
            await this._client.close();
            this.removeAllListeners();
            logger.info('Closed');
            resolve();
        });
    }

    /**
     * Gets the connection status.
     *
     * @returns {boolean} The connection status.
     */
    public get isConnected() {
        return this._connected;
    }

    /**
     * Gets the authentication status.
     * @returns {boolean} The authentication status.
     */
    public get isAuthenticated() {
        return this._waitAuth.EventIsResolved;
    }

    /**
     * Creates a packet of the specified type.
     * 
     * @param packetType - The type of the packet.
     * @returns The created packet.
     */
    private _makePacket(packetType: string): IOutPacket {
        let packet: IOutPacket = { id: ++this._id, type: packetType };
        logger.trace(`id=${packet.id};type=${packet.type}`);
        return packet;
    }

    public async subscribe() {
        return new Promise(async (resolve, reject) => {
            try {
                await this._waitAuthenticated();
                let response = await this._sendPacket(this._makePacket('subscribe_events'));
                logger.info('Subscribed to events');
                resolve((response as IServiceSuccess).result);
            }
            catch (err) {
                logger.error(`Error subscribing to events: ${err}`);
                reject(err);
            }
            // this._sendPacket(this._makePacket('subscribe_events'))
            //     .then((response: any) => {
            //         logger.info('Subscribed to events');
            //         resolve(response.result);
            //     })
            //     .catch((err) => {
            //         logger.error(`Error subscribing to events: ${err}`);
            //         reject(err);
            //     });
        });
    }

    /**
     * Retrieves the states from the Home Assistant interface.
     * @returns A promise that resolves to an array of states.
     */
    public async getStates(): Promise<any []> {
        return new Promise<any []>(async (resolve, reject) => {
            // await this._waitHaRunning();
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

    /**
     * Retrieves the configuration asynchronously.
     * @returns A promise that resolves with the configuration object.
     * @throws If there is an error retrieving the configuration.
     */
    public async getConfig(): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                let response = await this._sendPacket(this._makePacket('get_config'));
                logger.debug('Config acquired');
                resolve((response as IServiceSuccess).result);
            }
            catch (err) {
                logger.error(`Error getting config: ${err}`);
                reject(err);
            }
            // this._sendPacket(this._makePacket('get_config'))
            //     .then((response: any) => {
            //         logger.debug('Config acquired');
            //         // this._running = 'RUNNING' == response.result.state;
            //         resolve(response.result);
            //     })
            //     .catch((err) => {
            //         logger.error(`Error getting config: ${err}`);
            //         reject(err);
            //     });
        });
    }

    /**
     * Retrieves the panels from the server.
     * @returns A Promise that resolves with a string representing the panels.
     */
    public async getPanels(): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            // await this._waitHaRunning();
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

    /**
     * Calls a service with the specified domain, service, and data.
     * 
     * @param domain - The domain of the service.
     * @param service - The name of the service.
     * @param data - The data to be passed to the service.
     * @returns A promise that resolves to a string representing the result of the service call.
     */
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

    /**
     * Retrieves the REST parameters for making a POST request to update the state of an entity.
     * 
     * @param entityId - The ID of the entity to update.
     * @param value - The new value for the state of the entity.
     * @param newEntity - Indicates whether the entity is new or not.
     * @returns An object containing the request body and options for the POST request.
     */
    private _getRestParms(entityId: string, value: boolean | string | number, newEntity: boolean ): { body: any, options: any } {
        // TODO: Clean up this any types
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
            path: `${HaInterface.REST_PATH}/states/${entityId}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'authorization': `Bearer ${this._accessToken}`
            }
        };

        return { body: body, options: options };
    }

    /**
     * Adds a sensor with the specified entityId, value, and optional attributes.
     * 
     * @param entityId - The ID of the sensor entity.
     * @param value - The value of the sensor (boolean, string, or number).     * @param attributes - Optional attributes to be added to the sensor.     * @returns A promise that resolves when the sensor is successfully added, or rejects with an error.te fails.
     */
    public async addSensor(entityId: string, value: boolean | string | number, attributes?: object): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            const parameters = this._getRestParms(entityId, value, true);

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

    /**
     * Converts a JSON string or Buffer into a service message object.
     * 
     * @param msgJSON - The JSON string or Buffer to be converted.
     * @returns The converted service message object.
     * @throws Error if the server response is unrecognized.
     */
    public async updateSensor(entityId: IHaItem, value: boolean | string | number, forceUpdate: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const parameters = this._getRestParms(entityId.entityId, value, false);

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

    private _messageFactory(msgJSON: string | Buffer): IServiceAuthOk | IServiceAuthRequired | IServiceAuthInvalid | IServiceError | IServicePong | IServiceSuccess | IServiceEvent {
        let msg: any = JSON.parse(Buffer.isBuffer(msgJSON)? msgJSON.toString() : msgJSON);

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

    /**
     * Sets the '_connected' flag to false.
     */
    private _kill() {
        this._connected = false;
    }

    /**
     * Waits for authentication to complete.
     * @returns A promise that resolves when authentication is complete.
     */
    private async _waitAuthenticated(): Promise<void> {
        return new Promise<void>(async (resolve, _reject) => {
            await this._waitAuth.EventWait();
            resolve();
            // this._waitAuth.EventWait()
            // .then(() => {
            //     resolve()
            // });
        })
    }

    /**
     * Sends a packet to the HA server.
     *
     * @param packet - The packet to send.
     * @returns A promise that resolves with the response from the server.
     */
    private async _sendPacket(packet: IOutPacket): Promise<IServiceSuccess | IServiceError | IServicePong> {
        return new Promise<IServiceSuccess | IServiceError | IServicePong>(async (resolve, reject) => {
            await this._waitAuthenticated();
            logger.trace(`Sending packet id=${packet.id};type=${packet?.type || 'none'}`);
            this._packetTracker.addInFlight(packet.id, { packet: packet, resolve: resolve, reject: reject });
            this._client.send(JSON.stringify(packet));
        });
    }
}
