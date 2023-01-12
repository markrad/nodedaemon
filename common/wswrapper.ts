"use strict";

import WebSocket = require('ws');
import { getLogger, Level } from 'log4js';
import EventEmitter from 'events';

import { ErrorFactory, ConnectionError, DNSError, GenericSyscallError } from './haInterfaceError';
import { dumpError } from './errorUtil';

const CATEGORY = 'WSWrapper';
var logger = getLogger(CATEGORY);

export interface WSWrapperEvents {
    'connected': () => void;
    'disconnected': () => void;
    'message': (data: WebSocket.Data) => void;
};

export declare interface WSWrapper {
    on<U extends keyof WSWrapperEvents>(event: U, listner: WSWrapperEvents[U]): this;
    emit<U extends keyof WSWrapperEvents>(event: U, ...args: Parameters<WSWrapperEvents[U]>): boolean;
}

export class WSWrapper extends EventEmitter {
    private _url: string;
    private _pingInterval: number;
    private _pingTimer: NodeJS.Timer;
    private _connected: boolean;
    private _closing: boolean;
    private _client: WebSocket;
    public constructor(url: string, pingInterval: number, level?: Level) {
        super();

        if (level) logger.level = level;
        if (!url) throw new Error('Error: WSWrapper requires url');
        this._url = url;
        this._pingInterval = pingInterval ?? 0;
        this._pingTimer = null;
        this._connected = false;
        this._closing = false;
        this._client = null;
        logger.debug(`Constructed with ${this._url}`);
    }
    
    public async open(): Promise<void> {
        this._closing = false;
        // Note: It appears that ENOTFOUND can be thrown during docker upheaval thus it may be transient
        let handled = [ 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH' ];
        return new Promise(async (resolve, reject) => {

            while (true) {
                try {
                    logger.debug(`Connecting to ${this._url}`);
                    this._client = await this._open(this._url);
                    if (this._connected) break;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                catch (err) {
                    if (err instanceof DNSError) {
                        if (err.code != 'ENOTFOUND') {
                            logger.fatal(`Unhandled connection error ${err.syscall} - ${err.errno}`);
                            reject(err);
                            break;
                        }
                        else {
                            logger.info(`${err.message} - retrying`);
                        }
                        logger.fatal(`Unable to resolve host address: ${this._url}`);
                        reject(err);
                        break;
                    }
                    else if (err instanceof GenericSyscallError) {
                        logger.fatal(`Unhandled syscall error: ${err.syscall}`);
                        reject(err);
                        break;
                    }
                    else if (err instanceof ConnectionError) {
                        if (!(handled.includes(err.code))) {
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
                        dumpError(err, logger, 'FATAL');
                        reject(err);
                        break;
                    }
                }
                await new Promise<void>((resolve) => setTimeout(resolve, 1000));
            }
            // TODO: Control should not pass to here if the above fails
            logger.debug(`Connected to ${this._url}`);
            
            this._client
            .on('message', (data) => {
                logger.trace(`Data received:\n${JSON.stringify(data, null, 2)}`);
                this.emit('message', data);
            })
            .on('close', async (code, reason) => {
                this._connected = false;
                this.emit('disconnected');

                if (!this._closing) {
                    logger.warn(`Connection closed by server: ${code} ${reason} - reconnecting`);
                    await this.open();
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
        });
    }

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
            resolve();
        });
    }

    public get connected(): boolean {
        return this._connected;
    }

    public get url(): string {
        return this._url;
    }

    private async _open(url: string): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            var client = new WebSocket(url);
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
        });
    }

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
