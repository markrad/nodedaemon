"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const node_os_utils_1 = require("node-os-utils");
function mqttAppender(layout, otherOptions, client, mqttTopic) {
    const appender = (loggingEvent) => {
        client.publish(mqttTopic, `${layout(loggingEvent, otherOptions)}`);
    };
    appender.shutdown = (_done) => {
        client.end();
    };
    return appender;
}
function config(config, layouts) {
    let layout = config.layout ? layouts.layout(config.layout.type, config.layout) : layouts.coloredLayout;
    let mqttHost = config.host || "mqtt://127.0.0.1:1883";
    let mqttTopic = config.topic || `logger/${node_os_utils_1.os.hostname()}`;
    let mqttOptions = {};
    mqttOptions.clientId = config.clientid || node_os_utils_1.os.hostname() + '_logger';
    if (config.username != null)
        mqttOptions.username = config.username;
    if (config.password != null)
        mqttOptions.password = config.password;
    let client = mqtt_1.default.connect(`${mqttHost}`, mqttOptions);
    return mqttAppender(layout, config.otherOptions, client, mqttTopic);
}
exports.configure = config;
//# sourceMappingURL=mqttlogger.js.map