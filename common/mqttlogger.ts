"use strict";

import { Layout, LoggingEvent } from 'log4js';
import mqtt from 'mqtt';
import { os } from 'node-os-utils';
import { appender, appenderConfig} from "./appender";

function mqttAppender(layout: any, otherOptions: any, client: mqtt.MqttClient, mqttTopic: string): appender {
    let msgCache: string[] = [];
    const appender = (loggingEvent: LoggingEvent) => {
        if (client.connected) {
            let cachedLine: string;
            while (cachedLine = msgCache.shift()) {
                client.publish(mqttTopic, cachedLine);
            }
            client.publish(mqttTopic, `${layout(loggingEvent, otherOptions)}`);
        }
        else {
            msgCache.push(`${layout(loggingEvent, otherOptions)}`);
            if (msgCache.length > 100) {
                msgCache.shift();
            }
        }
    };

    appender.shutdown = (_done: any) => {
        client.end();
    };

    return appender;
}

function config(config: appenderConfig, layouts: any): appender {
    let layout: Layout = config.layout? layouts.layout(config.layout.type, config.layout) : layouts.coloredLayout;
    let mqttHost: string = config.host || "mqtt://127.0.0.1:1883";
    let mqttTopic: string = config.topic || `/logger/${os.hostname()}`;
    let mqttOptions: mqtt.IClientOptions = {};
    mqttOptions.clientId = config.clientid || os.hostname() + '_logger';
    if (config.username != null) mqttOptions.username = config.username;
    if (config.password != null) mqttOptions.password = config.password;

    let client: mqtt.MqttClient = mqtt.connect(mqttHost, mqttOptions);

    // client.on('connect', () => console.log('mqtt logger connected'));
    client.on('error', (err: any) => { 
        if (err.errno = -111) {
            client.end();
        }        
        console.error(`MQTT logger connection failed: ${(err as Error).message}`);      // Can't use the logger here
    });
    
    return mqttAppender(layout, config.otherOptions, client, mqttTopic);
}

export { config as configure };
