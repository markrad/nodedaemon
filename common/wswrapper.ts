"use strict";

import WebSocket = require('ws');
import { getLogger } from 'log4js';
import EventEmitter from 'events';

import { ErrorFactory, ConnectionError, DNSError, GenericSyscallError } from './haInterfaceError';

const CATEGORY = 'WSWrapper';
var logger = getLogger(CATEGORY);

export class WSWrapper extends EventEmitter {
    private _url: string;
    private _pingRate: number;
    private _pingTimer: NodeJS.Timer;
    private _connected: boolean;
    private _closing: boolean;
    private _client: WebSocket;
    public constructor(url: string, pingRate: number) {
        super();

        if (!url) throw new Error('Error: WSWrapper requires url');
        this._url = url;
        this._pingRate = pingRate ?? 0;
        this._pingTimer = null;
        this._connected = false;
        this._closing = false;
        this._client = null;
        logger.debug(`Constructed with ${this._url}`);
    }
    
    public async open(): Promise<void> {
        this._closing = false;
        let handled = [ 'ECONNREFUSED', 'ETIMEDOUT'];
        return new Promise(async (resolve, reject) => {
            while (true) {
                try {
                    logger.debug(`Connecting to ${this._url}`);
                    this._client = await this._open(this._url);
                    logger.debug(`Connected to ${this._url}`);
                    this._connected = true;
                    this._client.on('message',  (data) => {
                        logger.trace(`Data received:\n${JSON.stringify(data, null, 2)}`);
                        this.emit('message', data);
                    });
                    this._client.on('close', async (code, reason) => {
                        this._connected = false;
                        this.emit('disconnected');

                        if (!this._closing) {
                            logger.warn(`Connection closed by server: ${code} ${reason} - reconnecting`);
                            await this.open();
                        }
                    });
                    this._client.on('error', async (err) => {
                        logger.warn(`Connection error: ${err.message} - reconnecting`);
                        await this.close();
                        await this.open();
                    });
                    this._client.on('unexpected-response', (_clientRequest, _incomingMessage) => {
                        logger.warn('Unexpected response');
                    });
                    this._runPings();
                    this.emit('connected');
                    resolve();
                    break;
                }
                catch (err) {
                    if (err instanceof DNSError) {
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
                        if (!(err.code in handled)) {
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
                        logger.debug(JSON.stringify(err));
                        reject(err);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
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
            // await new Promise((resolve, _reject) => {
                // timer = setTimeout(() => {
                //     logger.warn('Failed to close before timeout')
                //     resolve(new Error('Failed to close connection'));
                // }, 5000);
                // this._client.once('close', (_reason, _description) => {
                //     logger.info('Closed');
                //     this.emit('close');
                // });
                this._client.close();
            // });
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
                resolve(client);
            };
            client.once('open', connectSucceeded);
            client.once('error', connectFailed);
        });
    }

    private _runPings() {
        if (this._pingRate > 0) {
            let pingId: number = 0;
            let pingOutstanding: number = 0;
            let pongWait: NodeJS.Timeout = null;
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
