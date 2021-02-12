const WebSocket = require('../../common/wswrapper');
var mqtt = require('mqtt');
var log4js = require('log4js');

const CATEGORY = 'DeconzHack';
var logger = log4js.getLogger(CATEGORY);

class DeconzHack {
    constructor(_controller, config) {

        if (!config.deconzhack || !config.deconzhack.devices || config.deconzhack.devices.length == 0) {
            logger.error('Missing deconzhack.devices section in config - this is required');
            throw new Error('Missing deconzhack.devices section in config');
        }

        this._mqtt = { ...{ host: '127.0.0.1', port: 1883, topicTemplate: 'deconzhack/switch/device_%deviceid%' }, ...(config.deconzhack.mqtt ?? {}) };
        if (this._mqtt.topicTemplate.search('%deviceid%') == -1) this._mqtt.topicTemplate += '%deviceid%'
        this._deconz = { ...{ host: '127.0.0.1', port: 8443}, ...(config.deconzhack.deconz ?? {}) };
        this._deviceIds = config.deconzhack.devices.map(item => Object.keys(item));
        this._deviceTargets = config.deconzhack.devices.map(item => Object.values(item));
        
        if (!this._mqtt.topicTemplate) this._mqtt.topicTemplate = 'deconzhack/switch/device_';
        this._client = null;
        this._ws = null;

        logger.debug('DeconzHack constructed');
    }

    async run() {
        return new Promise(async (resolve, reject) => {
            let client = 'deCONZHack'; 
            this._client = mqtt.connect(`mqtt://${this._mqtt.host}:${this._mqtt.port}`, { clientId: client, clean: true });
            this._client.on('error', err => logger.warn(`MQTT error ${err}`));
            this._client.on('reconnect', () => logger.warn('MQTT is reconnecting'));
            await new Promise(resolve => this._client.once('connect', resolve));
            logger.info('Connected to MQTT server');
            this._ws = new WebSocket(`ws://${this._deconz.host}:${this._deconz.port}`, 60);
            this._ws.on('message', (msg) => {
                var msgData = JSON.parse(msg);

                logger.trace(`Received:\n${JSON.stringify(msgData, null, 2)}`);
                
                let index = this._deviceIds.findIndex(item => item == msgData.uniqueid);
                if (index != -1 && msgData.state?.buttonevent) {
                    logger.debug(`Device ${this._deviceTargets[index]} state changed to ${msgData.state.buttonevent}`)
                    this._client.publish(this._mqtt.topicTemplate.replace('%deviceid%', this._deviceTargets[index]), msgData.state.buttonevent.toString());
                }
            });
            await this._ws.open();
            logger.info('Connected to deCONZ server');

            resolve();
        });
    }

    send(data) {
        this._ws.send(data);
    }

    async stop() {
        return new Promise(async (resolve, reject) => {
            await this._ws.close();
            this._client.end(resolve);
        });
    }
}

module.exports = DeconzHack;
