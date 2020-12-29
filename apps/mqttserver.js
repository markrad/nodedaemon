const EventEmitter = require('events').EventEmitter;

const CATEGORY = 'MQTTServer';
const logger = require('log4js').getLogger(CATEGORY);

class MqttServer extends EventEmitter {
    constructor(_controller, _config) {
        super();
        this.aedes = require('aedes')();
        this.port = 1883;
        this.server = require('net').createServer(this.aedes.handle);
        logger.info('Construction complete');
    }

    run() {
        this.server.listen(this.port, () => { 
            this.aedes.on('client', (client) => logger.debug(`New client ${client.id}`));
            this.aedes.on('clientReader', (client) => logger.debug(`Client ready ${client.id}`));
            this.aedes.on('clientDisconnect', (client) => logger.debug(`Client disconnected ${client.id}`));
            this.aedes.on('clientError', (client, err) => logger.debug(`Client errored ${client.id} - ${err.message}`));
            this.aedes.on('connectionError', (client, err) => logger.debug(`Connection errored ${client.id} - ${err.message}`));
            this.aedes.on('publish', (packet, client) => {
                logger.debug(`Publish ${client != null? client.id : 'none'} topic=${packet.topic} payload=${packet.payload.toString()}`);
            });
            this.aedes.on('subscribe', (options, client) => {
                let topics = '';
                options.forEach((topic) => topics += (topic.topic + ' '));
                logger.debug(`Subscribe ${client.id} topics=${topics}`);
            });
            logger.info('MQTT server started and listening on port ' + this.port)
        });
    }

    async stop() {
        return new Promise((resolve, _reject) => {
            this.aedes.close(() => { 
                logger.info('MQTT server stopped');
                resolve();
            });
        });
    }
}

module.exports = MqttServer;