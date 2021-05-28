"use strict";

const mqtt = require('mqtt');
const { os } = require('node-os-utils');

function mqttAppender(layout, timezoneOffset, client, mqttTopic) {
    const appender = (loggingEvent) => {
        client.publish(mqttTopic, `${layout(loggingEvent, timezoneOffset)}`);
    };

    appender.shutdown = (_done) => {
        client.end();
    };

    return appender;
}

function config(config, layouts) {
    let layout = config.layout? layouts.layout(config.layout.type, config.layout) : layouts.coloredLayout;
    let mqttHost = config.host || "mqtt://127.0.0.1:1883";
    let mqttTopic = config.topic || `logger/${os.hostname()}`;
    let mqttOptions = {};
    mqttOptions.clientid = config.clientid || os.hostname() + '_logger';
    if (config.username != null) mqttOptions.username = mqttUsername;
    if (config.password != null) mqttOptions.password = mqttPassword;

    let client = mqtt.connect(`${mqttHost}`, mqttOptions);
    
    return mqttAppender(layout, config.timezoneOffset, client, mqttTopic);
}

exports.configure = config;