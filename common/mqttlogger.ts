"use strict";

import { Layout, LoggingEvent } from 'log4js';
import mqtt from 'mqtt';
import { os } from 'node-os-utils';

type appender = {
    (loggingEvent: LoggingEvent): void; 
}

type appenderConfig = {
    host?: string;
    topic?: string;
    layout?: any;
    username?: string;
    password?: string;
    clientid?: string;
    otherOptions?: any;
}

function mqttAppender(layout: any, otherOptions: any, client: mqtt.MqttClient, mqttTopic: string): appender {
    const appender = (loggingEvent: LoggingEvent) => {
        client.publish(mqttTopic, `${layout(loggingEvent, otherOptions)}`);
    };

    appender.shutdown = (_done) => {
        client.end();
    };

    return appender;
}

function config(config: appenderConfig, layouts: any): appender {
    let layout: Layout = config.layout? layouts.layout(config.layout.type, config.layout) : layouts.coloredLayout;
    let mqttHost: string = config.host || "mqtt://127.0.0.1:1883";
    let mqttTopic: string = config.topic || `logger/${os.hostname()}`;
    let mqttOptions: mqtt.IClientOptions = {};
    mqttOptions.clientId = config.clientid || os.hostname() + '_logger';
    if (config.username != null) mqttOptions.username = config.username;
    if (config.password != null) mqttOptions.password = config.password;

    let client: mqtt.MqttClient = mqtt.connect(`${mqttHost}`, mqttOptions);
    
    return mqttAppender(layout, config.otherOptions, client, mqttTopic);
}

export { config as configure };
