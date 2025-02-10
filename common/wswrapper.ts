"use strict";

import WebSocket = require('ws');
import { HttpProxyAgent } from 'http-proxy-agent';
import { getLogger, Level } from 'log4js';
import EventEmitter from 'events';

import { ErrorFactory, ConnectionError, DNSError, GenericSyscallError } from './haInterfaceError';
import { dumpError } from './errorUtil';

const CATEGORY = 'WSWrapper';
var logger = getLogger(CATEGORY);

/**
 * Options for WSWrapper.
 */
export type WSWrapperOptions = {
    url: string | URL;
    proxyUrl: string | URL;
    pingInterval: number;
    level?: string | Level;
}

/**
 * Represents the events supported by the IWSWrapper interface.
 */
export interface IWSWrapperEvents {
    'connected': () => void;
    'disconnected': () => void;
    'message': (data: WebSocket.Data) => void;
    'fatal': (err: any) => void;
};

/**
 * Represents a WebSocket wrapper.
 * 
 * @interface
 */
export declare interface WSWrapper {
    on<U extends keyof IWSWrapperEvents>(event: U, listner: IWSWrapperEvents[U]): this;
    emit<U extends keyof IWSWrapperEvents>(event: U, ...args: Parameters<IWSWrapperEvents[U]>): boolean;
}

/**
 * WebSocket wrapper class that provides functionality for connecting to and communicating with a WebSocket server.
 * @extends EventEmitter
 */
export class WSWrapper extends EventEmitter {
    private _url: string | URL;
    private _pingInterval: number;
    private _pingTimer: NodeJS.Timer;
    private _connected: boolean;
    private _closing: boolean;
    private _client: WebSocket;
    /**
     * Constructs a new instance of the WSWrapper class.
     * 
     * @param options - The options for configuring the WSWrapper.
     * @throws Error if the options.url is not provided.
     */
    public constructor(options: WSWrapperOptions) {
        super();

        if (options.level) logger.level = options.level;
        if (!options.url) throw new Error('Error: WSWrapper requires url');
        this._url = options.url;
        this._pingInterval = options.pingInterval ?? 0;
        this._pingTimer = null;
        this._connected = false;
        this._closing = false;
        this._client = null;
        logger.debug(`Constructed with ${this._url}`);
    }
    
    /**
     * Opens a connection to the specified URL.
     * 
     * @returns A Promise that resolves when the connection is successfully opened.
     * @throws {DNSError} If there is an unhandled DNS error.
     * @throws {GenericSyscallError} If there is an unhandled syscall error.
     * @throws {ConnectionError} If there is an unhandled connection error.
     * @throws {Error} If there is an unhandled error.
     */
    public async open(): Promise<void> {
        this._closing = false;
        // Note: It appears that ENOTFOUND can be thrown during docker upheaval thus it may be transient
        let handled = [ 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH' ];
        return new Promise(async (resolve, reject) => {

            let earlyClose = (code: number, reason: string) => {
                // It is possible to receive a close event before the open event
                let err = new Error(`Connection closed by server before open: ${code} ${reason}`);
                logger.error(err.message);
                this.emit('fatal', err);
                reject(err);
            };

            while (true) {
                try {
                    logger.debug(`Connecting to ${this._url}`);
                    this._client = await this._open(this._url);
                    this._client.once('close', earlyClose);
                    if (this._connected)
                    {
                        logger.debug('Open event received');
                        this._client.removeListener('close', earlyClose);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                catch (err) {
                    if (err instanceof DNSError) {
                        dumpError(err, logger);
                        // Retry on ENOTFOUND
                        if (err.errno != -3008) {
                            logger.fatal(`Unhandled DNS error ${err.syscall} - ${err.errno}`);
                            this.emit('fatal', err);
                            reject(err);
                        }
                        else {
                            logger.info(`${err.message} - retrying`);
                        }
                    }
                    else if (err instanceof GenericSyscallError) {
                        logger.fatal(`Unhandled syscall error: ${err.syscall}`);
                        this.emit('fatal', err);
                        reject(err);
                    }
                    else if (err instanceof ConnectionError) {
                        if (!(handled.includes(err.code))) {
                            logger.fatal(`Unhandled connection error ${err.syscall} - ${err.errno}`);
                            this.emit('fatal', err);
                            reject(err);
                        }
                        else {
                            logger.info(`${err.message} - retrying`);
                        }
                    }
                    else {
                        logger.fatal(`Unhandled error ${err.message}`);
                        dumpError(err, logger, 'FATAL');
                        reject(err);
                    }
                }
                await new Promise<void>((resolve) => setTimeout(resolve, 1000));
            }
            if (this.connected) {
                logger.debug(`Connected to ${this._url}`);
                
                this._client
                .on('message', (data) => {
                    logger.trace(`Data received:\n${JSON.stringify(data, null, 2)}`);
                    this.emit('message', data);
                })
                .on('close', async (code, reason) => {
                    this._connected = false;
                    this.emit('disconnected');

                    // Only retry the connection on these close codes - all others are unrecoverable
                    let handled = [ 1000, 1001, 1006, 1011, 1012, 1013 ];

                    if (!this._closing) {
                        logger.warn(`Connection closed by server: ${code} ${reason} - reconnecting`);
                        if (handled.includes(code)) {
                            await this.open();
                        }
                        else {
                            this.emit('fatal', new Error(`Connection closed by server: ${code} ${reason}`));
                        }
                    }
                })
                .on('error', async (err) => {
                    logger.warn(`Connection error: ${err.message} - reconnecting`);
                    await this.close();
                    await this.open();
                })
                .on('unexpected-response', (_clientRequest, _incomingMessage) => {
                    logger.warn('Unexpected response');
                });
                this.emit('connected');
                this._runPings();
                resolve();
            }
            else {
                logger.fatal('Unrecoverable connect error');
            }
        });
    }

    /**
     * Sends data over the WebSocket connection.
     * 
     * @param data - The data to be sent. It can be a string or a Buffer.
     * @returns A promise that resolves when the data is sent successfully, or rejects with an error if sending fails.
     */
    public async send(data: string | Buffer): Promise<void> {
        return new Promise<void>(async (resolve, reject) =>{
            if (!this._connected || this._client.readyState != WebSocket.OPEN) {
                if (this._closing) {
                    // We are closing - ignore this
                    resolve();
                }
                logger.warn('WebSocket is not open - trying to reconnect');
                this._connected = false;
                await this.open();
            }
            this._client.send(data, (err: Error) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    /**
     * Closes the WebSocket connection.
     * 
     * @returns A promise that resolves when the connection is closed.
     */
    public async close(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            this._closing = true;
            logger.info('Closing');
            this._connected = false;
            let timer: NodeJS.Timeout = null;
            this._client.close();
            this.emit('disconnected');
            clearTimeout(timer);
            this._client.removeAllListeners();
            logger.info('Closed');
            resolve();
        });
    }

    /**
     * Gets the connection status of the WebSocket wrapper.
     * @returns {boolean} The connection status.
     */
    public get connected(): boolean {
        return this._connected;
    }

    /**
     * Gets the URL of the WebSocket server.
     *
     * @returns The URL of the WebSocket server.
     */
    public get url(): string | URL{
        return this._url;
    }

    /**
     * Opens a WebSocket connection to the specified URL with optional proxy configuration.
     * 
     * @param url - The URL to connect to.
     * @param proxy - The proxy URL to use for the connection (optional).
     * @returns A promise that resolves to the WebSocket instance upon successful connection.
     * @throws An error if the connection fails.
     */
    private async _open(url: string | URL, proxy?: string | URL): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            let options: WebSocket.ClientOptions = {};
            if (proxy) options.agent = new HttpProxyAgent(proxy);
            var client = new WebSocket(url, options);
            var connectFailed = (err: Error) => {
                client.off('connected', connectSucceeded);
                reject(ErrorFactory(err));
            };

            var connectSucceeded = () => {
                client.off('connectFailed', connectFailed);
                this._connected = true;
                resolve(client);
            };
            client.once('open', connectSucceeded);
            client.once('error', connectFailed);
            // client.once('close', (i, ...err) => {
            //     // BUG: This will be called if the TLS verification fails - currently not handled
            //     logger.warn(`Connection closed ${err[0]}`);
            // });
            client.once('unexpected-response', (_clientRequest, _incomingMessage) => {
                logger.warn('Unexpected response');
            });
            client.once('upgrade', (_response) => {
                logger.debug('Upgrade received');
            });
        });
    }

    /**
     * Runs pings to keep the WebSocket connection alive.
     * 
     * @remarks
     * This method sets up a timer to send ping messages to the server at regular intervals.
     * It also handles the corresponding pong messages received from the server.
     * If no pong response is received within a certain threshold, it will attempt to reconnect.
     * 
     * @private
     */
    private _runPings() {
        if (!this._pingTimer && this._pingInterval > 0) {
            let pingId: number = 0;
            let pingOutstanding: number = 0;
            let pongWait: NodeJS.Timeout = null;
            this._client.on('pong', (_data) => {
                clearTimeout(pongWait);
                pingOutstanding = 0;
                logger.debug('Pong received');
            });
            this._pingTimer = setInterval(async () => {
                if (!this._connected) {
                    clearInterval(this._pingTimer);
                    this._pingTimer = null;
                }
                else {
                    if (pingOutstanding > 10) {
                        logger.error('No pong responses - reconnecting');
                        clearInterval(this._pingTimer);
                        await this.close();
                        await this.open();
                        pingOutstanding = 0;
                    }
                    else if (pingOutstanding > 5) {
                        logger.warn(`Outstanding ping count: ${pingOutstanding}`);
                    }
                    pongWait = setTimeout(() => {
                        logger.warn('Pong not received');
                    }, 5000);
                    pingOutstanding++;
                    this._client.ping((++pingId).toString(), true);
                    logger.debug(`Ping ${pingId} sent`);
                }
            }, this._pingInterval * 1000);
        }
    }
}
