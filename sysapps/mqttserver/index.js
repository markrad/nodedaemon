const EventEmitter = require('events').EventEmitter;

const CATEGORY = 'MQTTServer';
const logger = require('log4js').getLogger(CATEGORY);

class MqttServer extends EventEmitter {
    constructor(_controller, _config) {
        super();
        this._aedes = require('aedes')();
        this._port = 1883;
        this._server = require('net').createServer(this._aedes.handle);
        this._clients = [];
        logger.info('Construction complete');
    }

    run() {
        this._server.listen(this._port, () => { 
            this._aedes.on('client', (client) => {
                this._clients.push(client);
                logger.debug(`New client ${client.id}`)
            });
            this._aedes.on('clientReader', (client) => logger.debug(`Client ready ${client.id}`));
            this._aedes.on('clientDisconnect', (client) => {
                this._clients = this._clients.filter(value => value != client);
                logger.debug(`Client disconnected ${client.id}`)
            });
            this._aedes.on('clientError', (client, err) => {
                this._clients = this._clients.filter(value => value != client);
                logger.debug(`Client errored ${client.id} - ${err.message}`)
            });
            this._aedes.on('connectionError', (client, err) => logger.debug(`Connection errored ${client.id} - ${err.message}`));
            this._aedes.on('publish', (packet, client) => {
                logger.debug(`Publish ${client != null? client.id : 'none'} topic=${packet.topic} payload=${packet.payload.toString()}`);
            });
            this._aedes.on('subscribe', (options, client) => {
                let topics = '';
                options.forEach((topic) => topics += (topic.topic + ' '));
                logger.debug(`Subscribe ${client.id} topics=${topics}`);
            });
            logger.info('MQTT server started and listening on port ' + this._port)
        });
    }

    async stop() {
        return new Promise((resolve, _reject) => {
            this._aedes.close(() => { 
                logger.info('MQTT server stopped');
                resolve();
            });
        });
    }

    get clients() {
        return this._clients;
    }
}

module.exports = MqttServer;