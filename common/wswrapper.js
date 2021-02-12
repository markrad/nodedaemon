const WebSocket = require('ws');
var log4js = require('log4js');
const EventEmitter = require('events');

const { ErrorFactory, ConnectionError, DNSError, GenericSyscallError, WebSocketError } = require('./haInterfaceError');

const CATEGORY = 'WSWrapper';
var logger = log4js.getLogger(CATEGORY);

class WSWrapper extends EventEmitter {
    constructor(url, pingRate) {
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
    
    async open() {
        this._closing = false;
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
                        if (this._closing == false) {
                            logger.warn(`Connection closed by server: ${code} ${reason} - reconnecting`);
                            await this.close();
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
                    resolve();
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
                        break;
                    }
                    else if (err instanceof ConnectionError) {
                        if (err.code != 'ECONNREFUSED') {
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
                        reject(err);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        });
    }

    async close() {
        return new Promise(async (resolve, _reject) => {
            this._closing = true;
            logger.info('Closing');
            this._connected = false;
            let timer = 0;
            await new Promise((resolve, _reject) => {
                timer = setTimeout(() => {
                    logger.warn('Failed to close before timeout')
                    resolve(new Error('Failed to close connection'));
                }, 5000);
                this._client.once('close', (_reason, _description) => {
                    logger.info('Closed');
                });
                this._client.close();
            });
            clearTimeout(timer);
            this._client.removeAllListeners();
            resolve();
        });
    }

    get connected() {
        return this._connected();
    }

    async _open(url) {
        return new Promise((resolve, reject) => {
            var client = new WebSocket(url);
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

    _runPings() {
        if (this._pingRate > 0) {
            let pingId = 0;
            let pingOutstanding = 0;
            let pongWait = 0;
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

module.exports = WSWrapper;
