import { WSWrapper } from '../../common/wswrapper';
import mqtt from 'mqtt';
import { getLogger } from 'log4js';
import { HaMain } from '../../hamain';
import { IApplication } from '../../common/IApplication';
import { LogLevelValidator } from '../../common/loglevelvalidator';

const CATEGORY = 'DeconzHack';
var logger = getLogger(CATEGORY);

type MqttConfig = {
    host?: string;
    port?: number;
    topicTemplate?: string;
}

type DeconzConfig = {
    host?: string;
    port?: number;
}

type Device = {
    uniqueId: string;
    target: string;
}

type Config = {
    deconz?: DeconzConfig;
    mqtt?: MqttConfig;
    devices: Device[];
    printMessages?: boolean;
}


/* -------------------------------------------------------------------------- *\
    printMessages: true will print everything sent by deconz which can be a
    lot but it will let you find the uniqueId for the push button you are
    trying to respond to. Aqara push buttons are sent as events rather than
    state changes. This will convert it to a state event and turn on a MQTT
    device
    The topic template allows one to specify the topic. However this will 
    add a device identifier to the topic. If the topic is deconz/devices/
    then it will be published as deconz/devices/<index target> from the
    devices array. Default is deconzhack/switch/device_<index target>.
    Config format:
    {
        "deconzhack": {
            "mqtt": {
                "host": "<mqtt server host name that ha subscribes to - default localhost>",
                "port": <port number for above - default 1883>,
                "topicTemplate": <topic to use. If it doesn't contain %deviceid% this will be appended and converted to deviceid_<target> when published
            },
            "deconz": {
                "host": "<deconz instance host name - default localhost>",
                "port": <port number for above default 8443>
            },
            "printMessages": <true or false - use true to determine uniqueId for your device required in the next section>
            "devices": [
                { "uniqueId": "<Obtain this from printMessages> ", "target": "<anything to match to an MQTT device that you created>" },
            ]
        }
    }
    The string %deviceid% in the topic will be replaced with the target 
    value. 
\* -------------------------------------------------------------------------- */
class DeconzHack implements IApplication {
    private _mqttOptions: mqtt.IClientOptions;
    private _mqttConfig: MqttConfig;
    private _deconzConfig: DeconzConfig;
    private _devices: Device[];
    private _ws: WSWrapper;
    private _client: mqtt.MqttClient;
    private _printMessages: boolean = false;
    constructor(_controller: HaMain) {
        this._client = null;
        this._ws = null;
        this._mqttOptions = { clean: true, clientId: "deCONZHack"}
        logger.info('Constructed');
    }

    validate(configIn: any): boolean {
        let config: Config = configIn;
        if (!config.devices || config.devices.length == 0) {
            logger.error('Missing deconzhack.devices section in config - this is required');
            return false;
        }

        this._mqttConfig = { ...{ host: '127.0.0.1', port: 1883, topicTemplate: 'deconzhack/switch/device_%deviceid%' }, ...(config.mqtt ?? {}) };
        if (this._mqttConfig.topicTemplate.search('%deviceid%') == -1) this._mqttConfig.topicTemplate += '%deviceid%'
        this._deconzConfig = { ...{ host: '127.0.0.1', port: 8443}, ...(config.deconz ?? {}) };
        this._devices = config.devices;
        this._printMessages = config.printMessages ?? false;
        logger.info('Validated successfully');

        return true;
    }

    async run(): Promise<boolean> {
        return new Promise(async (resolve, _reject) => {
            this._client = mqtt.connect(`mqtt://${this._mqttConfig.host}:${this._mqttConfig.port}`, this._mqttOptions);
            this._client.on('error', err => logger.warn(`MQTT error ${err}`));
            this._client.on('reconnect', () => logger.warn('MQTT is reconnecting'));
            await new Promise(resolve => this._client.once('connect', resolve));
            logger.info('Connected to MQTT server');
            this._ws = new WSWrapper(`ws://${this._deconzConfig.host}:${this._deconzConfig.port}`, 60);
            this._ws.on('message', (msg) => {
                if (this._printMessages) logger.info(msg);
                var msgData = JSON.parse(msg);

                logger.trace(`Received:\n${JSON.stringify(msgData, null, 2)}`);
                
                if (msgData.state?.buttonevent) {
                    let index: Device = this._devices.find((item: Device) => item.uniqueId == msgData.uniqueid);

                    if (index != undefined) {
                        logger.debug(`Device ${index.uniqueId} state changed to ${msgData.state.buttonevent}`);
                        this._client.publish(this._mqttConfig.topicTemplate.replace('%deviceid%', index.target), msgData.state.buttonevent.toString());
                    }
                }
            });
            await this._ws.open();
            logger.info('Connected to deCONZ server');

            resolve(true);
        });
    }

    send(data: string | Buffer) {
        this._ws.send(data);
    }

    async stop() {
        return new Promise(async (resolve, _reject) => {
            await this._ws.close();
            this._client.end(false, null, resolve);
        });
    }

    public get logging(): string {
        return logger.level;
    }

    public set logging(value: string) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            logger.error(err.message);
            throw err;
        }
        else {
            logger.level = value;
        }
    }
}

module.exports = DeconzHack;
