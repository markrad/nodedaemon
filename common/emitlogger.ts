"use strict";

// FUTURE: Deprecate this?
import { Layout, LoggingEvent } from 'log4js';
import { EventEmitter } from 'events';
import { appender, appenderConfig} from "./appender";

class LogEmitter extends EventEmitter {
    constructor() {
        super();
    }

    public sendLoggingEvent(loggingEvent: string): void {
        this.emit('logmessage', loggingEvent);
    }
}

const logEmitter: LogEmitter = new LogEmitter();

function emitAppender(layout: any, otherOptions: any): appender {
    const appender = (loggingEvent: LoggingEvent) => {
        logEmitter.sendLoggingEvent(`${layout(loggingEvent, otherOptions)}`);
    };

    appender.shutdown = (_done: any) => {
        logEmitter.removeAllListeners();
    };

    return appender;
}

function config(config: appenderConfig, layouts: any): appender {
    let layout: Layout = config.layout? layouts.layout(config.layout.type, config.layout) : layouts.coloredLayout;
    
    return emitAppender(layout, config.otherOptions);
}

export { config as configure, logEmitter };
