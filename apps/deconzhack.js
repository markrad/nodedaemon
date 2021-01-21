const WebSocket = require('ws');
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

        this._mqtt = config.deconzhack.mqtt || {};
        this._deconz = config.deconzhack.deconz || {};

        if (!this._mqtt.host) this._mqtt.host = '127.0.0.1';
        if (!this._mqtt.port) this._mqtt.port = 8883;
        if (!this._deconz.host) this._deconz.host = '127.0.0.1';
        if (!this._deconz.port) this._deconz.port = 8443;

        this._devices = config.deconzhack.devices.map(dev => dev.toString());
        
        if (!this._mqtt.topic) this._mqtt.topic = 'deconzhack/switch/device_';
        this._client = null;
        this._ws = null;

        logger.debug('DeconzHack constructed');
    }

    async run() {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                var timeout = setTimeout(() => {
                    reject(new Error('Timeout awaiting connection to MQTT server'));
                }, 3000);

                this._client = mqtt.connect(`mqtt://${this._mqtt.host}:${this._mqtt.port}`, { clientId: 'deCONZHack'});
                await new Promise(resolve => this._client.once('connect', resolve));
                clearTimeout(timeout);
                logger.debug('Connected to MQTT server');

                timeout = setTimeout(() => {
                    reject(new Error('Timeout awaiting connection to deCONZ server'));
                }, 30000);

                this._ws = new WebSocket(`ws://${this._deconz.host}:${this._deconz.port}`);
                await new Promise(resolve => this._ws.once('open', resolve));
                clearTimeout(timeout);
                logger.debug('Connected to deCONZ server');

                this._ws.onmessage = (msg) => {
                    var msgData = JSON.parse(msg.data);
        
                    if (this._devices.includes(msgData.id || '') && msgData.state && msgData.state.buttonevent) {
                        logger.debug(`Device ${msgData.id} state changed to ${msgData.state.buttonevent}`)
                        this._client.publish(this._mqtt.topic + msgData.id, msgData.state.buttonevent.toString());
                    }
                }

                resolve();
            }, 3000);
        });
    }

    async stop() {
        return new Promise((resolve, reject) => {
            this._ws.close();
            this._client.end(resolve);
        });
    }
}

module.exports = DeconzHack;
