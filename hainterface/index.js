const EventEmitter = require('events');
var WebSocketClient = require('websocket').client;
var log4js = require('log4js');
const { reject } = require('underscore');

const { ErrorFactory, ConnectionError, DNSError, GenericSyscallError, WebSocketError, AuthenticationError } = require('./haInterfaceError');

const CATEGORY = 'HaInterface';

var logger = log4js.getLogger(CATEGORY);

class HaInterface extends EventEmitter {
    constructor(url, accessToken, pingRate) {
        super();
        this.accessToken = accessToken;
        this.connection = null;
        this.client = new WebSocketClient();
        this.url = url;
        this.id = 0;
        this.tracker = {};
        this.pingRate = pingRate || 60000;
        this.pingInterval = 0;
        this.closing = false;
        this.connected = false;
    }

    async start() {
        let ret = new Promise(async (resolve, reject) => {
            try {
                this.connection = await this._connect(this.client, this.url);
                // await this._authenticate(this.connection);
                logger.info(`Connection complete`);
                this.connected = true;
                let that = this;

                this.connection.on('message', (message) => {
                    if (message.type != 'utf8') {
                        logger.warn(`Unrecognized message type: ${message.type}`);
                    }
                    else {
                        let msg = JSON.parse(message.utf8Data);
        
                        if (msg.type == 'pong' || msg.type == 'result') {
                            if (msg.type != 'pong') {
                                logger.trace(`Received:\n${JSON.stringify(JSON.parse(message.utf8Data), null, 2)}`);
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

                this.connection.on('error', async (err) => {
                    logger.debug(`Connection errored: ${err} - reconnecting`);
                    this._kill();
                    this.connection = await this._connect(this.client, this.url);
                    // await this._authenticate(this.connection);
                    logger.info(`Reconnection complete`);
                    this.connected = true;
                    });

                this.connection.on('close', async (reasonCode, description) => {
                    logger.info(`Connection closed: ${reasonCode} - ${description}`);

                    if (!this.closing) {
                        logger.debug('Assuming service was restarted - reconnecting');
                        this._kill();
                        this.connection = await this._connect(this.client, this.url);
                        // await this._authenticate(this.connection);
                        this.connected = true;
                        logger.info(`Reconnection complete`);
                        this.connected = true;
                    }
                    else {
                        closing = false;
                    }
                });

                this.pingInterval = setInterval(() => {
                    let ping = { id: ++this.id, type: 'ping' };
                    this._sendPacket(ping, null)
                        .then((_response) => {})
                        .catch((err) => {
                            logger.error(`Ping failed ${err}`);
                            this.emit('error', err)
                        });
                }, this.pingRate);

                resolve();
            }
            catch (err) {
                logger.fatal(`Connection failed: ${err}`);
                reject(err);
            }
        });

        return ret;
    }

    async _connect(client, url) {

        return new Promise(async (resolve, reject) => {
            var connection;

            while (true) {
                try {
                    connection = await this._innerconnect(client, url);
                    this._authenticate(connection)
                        .then(() => resolve(connection))
                        .catch((err) => reject(err));
                    //resolve(connection);
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
                        if (err.errno != 'ECONNREFUSED') {
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
                
                this._wait(1);
            }
        });
    }

    async _innerconnect(client, url) {
        return new Promise((resolve, reject) => {
            var connectFailed = (err) => {
                client.off('connected', connectSucceeded);
                reject(ErrorFactory(err));
            };

            var connectSucceeded = (connection) => {
                client.off('connectFailed', connectFailed);
                resolve(connection);
            };
            client.once('connect', connectSucceeded);
            client.once('connectFailed', connectFailed);
            client.connect(url, null, null, null, null);
        });
    }

    async _authenticate(connection) {
        let ret = new Promise((resolve, reject) => {
            logger.debug('Authenticating');

            connection.once('message', (message) => {
                if (message.type != 'utf8') {
                    logger.debug('wrong data type for auth_required');
                    reject(new WebSocketError('Expected auth_required - received binary packet'));
                }

                let msg = JSON.parse(message.utf8Data);

                if (msg.type != 'auth_required') {
                    logger.debug('Did not get auth_required');
                    reject(new AuthenticationError(`Expected auth_required - received ${msg.type}`));
                }

                connection.once('message', (message) => {
                    if (message.type != 'utf8') {
                        reject(new WebSocketError('Expected auth - received binary packet'));
                    }

                    let authResponse = JSON.parse(message.utf8Data);

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
                        resolve(connection);
                    }
                });

                let auth = { type: 'auth', access_token: this.accessToken };
                logger.debug(`Sending auth \n${JSON.stringify(auth, null, 2)}`);
                connection.sendUTF(JSON.stringify(auth), (err) => {
                    if (err) {
                        reject(err);
                    }
                });
            });
        });

        return ret;
    }

    async _wait(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async stop() {
        let ret = new Promise((resolve, reject) => {
            this.closing = true;
            logger.info('Closing');

            let timer = setTimeout(() => {
                logger.warn('Failed to close before timeout')
                reject(new Error('Failed to close connection'));
            }, 5000);
            this.connection.once('close', (reason, description) => {
                logger.info('Closed');
                clearTimeout(timer);
                resolve();
            });
            this._kill();
            this.connection.close(1000);
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
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'subscribe_events' };
            this._sendPacket(packet, null)
                .then((response) => {
                    logger.info('Subscribed to events');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error subscribing to events: ${err}`);
                    reject(err);
                });
        });

        return ret;
    }

    async getStates() {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'get_states' };
            this._sendPacket(packet, null)
                .then((response) => {
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

    async getConfig() {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'get_config' };
            this._sendPacket(packet, null)
                .then((response) => {
                    logger.info('Config acquired');
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
                .then((response) => {
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

    async callService(domain, service, data) {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'call_service', domain: domain, service: service, service_data: data };
            this._sendPacket(packet, null)
                .then((response) => {
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
                        logger.error(`Call failed: ${response}`);
                        reject(new Error('Bad response:' + JSON.stringify(response)));
                    }
                },
            };
            this.connection.sendUTF(JSON.stringify(packet), (err) => {
                if (err) {
                    reject(err);
                }
            });
        });

        return ret;
    }
}

module.exports = HaInterface;