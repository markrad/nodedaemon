import { LoggingEvent } from 'log4js';

export type appender = {
    (loggingEvent: LoggingEvent): void; 
}

export type appenderConfig = {
    host?: string;
    topic?: string;
    layout?: any;
    username?: string;
    password?: string;
    clientid?: string;
    otherOptions?: any;
}
