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
    let mqttHost = config.host || "127.0.0.1";
    let mqttPort = config.port || "1883";
    let mqttClient = config.client || os.hostname() + '_logger';
    let mqttTopic = config.topic || `logger/${os.hostname()}`;
    let client = mqtt.connect(`mqtt://${mqttHost}:${mqttPort}`, { clientid: mqttClient, clean: true });
    //this._client.once('connect', resolve));
    
    return mqttAppender(layout, config.timezoneOffset, client, mqttTopic);
}

exports.configure = config;