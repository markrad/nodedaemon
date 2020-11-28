const EventEmitter = require('events');
var WebSocketClient = require('websocket').client;
var log4js = require('log4js');

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
    }

    async start() {
        let ret = new Promise(async (resolve, reject) => {
            try {
                this.connection = await this._connect();
                logger.info(`Connection complete`);
                let eventCount = 0;
                let that = this;

                this.connection.on('message', (message) => {
                    if (message.type != 'utf8') {
                        logger.warn(`Unrecognized message type: ${message.type}`);
                        reject(new Error(`Unrecognized message type: ${message.type}`))
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

                this.connection.on('error', (err) => {
                    logger.debug(`Connection errored: ${err}`);
                    this.emit('error', err);
                });

                this.connection.on('close', (reasonCode, description) => {
                    logger.info(`Connection closed: ${reasonCode} - ${description}`);
                    this.emit('close', reasonCode, description);
                });

                this.pingInterval = setInterval(() => {
                    let ping = { id: ++this.id, type: 'ping' };
                    this.sendPacket(ping, null)
                        .then((_response) => {})
                        .catch((err) => {
                            logger.error(`Ping failed ${err}`);
                            this.emit('error', err)
                        });
                }, this.pingRate);

                resolve();
            }
            catch (err) {
                loggger.error(`Connection failed: ${err}`);
                reject(err);
            }
        });

        return ret;
    }

    async _connect() {
        let ret = new Promise((resolve, reject) => {

            this.client.once("connect", (connection) => {
                connection.once('message', (message) => {
                    if (message.type != 'utf8') {
                        reject(new Error('Expected auth_required - received binary packet'));
                    }

                    let msg = JSON.parse(message.utf8Data);

                    if (msg.type != 'auth_required') {
                        reject(new Error(`Expected auth_required - received ${msg.type}`));
                    }

                    let auth = { type: 'auth', access_token: this.accessToken };

                    connection.once('message', (message) => {
                        if (message.type != 'utf8') {
                            reject(new Error('Expected auth - received binary packet'));
                        }

                        let authResponse = JSON.parse(message.utf8Data);

                        if (authResponse.type != 'auth_ok') {
                            if (authResponse.type == 'auth_invalid') {
                                reject(new Error(authResponse.message));
                            }
                            else {
                                reject(new Error(`Expected an auth response - received ${authResponse.type}`));
                            }
                        }
                        else {
                            logger.info('Authentication is good');
                            resolve(connection);
                        }
                    });

                    connection.sendUTF(JSON.stringify(auth), (err) => {
                        if (err) {
                            reject(err);
                        }
                    });
                })
            });
        });

        this.client.connect(this.url, null, null, null, null);

        return ret;
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
            clearTimeout(this.pingInterval);
            this.connection.close(1000);
        });

        return ret;
    }

    kill() {
        clearTimeout(this.pingInterval);
    }

    async subscribe() {
        let ret = new Promise((resolve, reject) => {
            let packet = { id: ++this.id, type: 'subscribe_events' };
            this.sendPacket(packet, null)
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
            this.sendPacket(packet, null)
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
            this.sendPacket(packet, null)
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
            this.sendPacket(packet, null)
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
            this.sendPacket(packet, null)
                .then((response) => {
                    logger.info('Service call successful');
                    resolve(response.result);
                })
                .catch((err) => {
                    logger.error(`Error calling service ${err}`);
                    reject(err);
                });
    });

        return ret;
    }

    async sendPacket(packet, handler) {
        let ret = new Promise((resolve, reject) => {
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