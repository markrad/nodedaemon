import { KeepAlive } from "./keepalive";
import { getLogger, Logger, Configuration, configure } from "log4js";


let loggerOptions: Configuration = {
    appenders: {
        out: { type: 'stdout' },
    },
    categories: {
        default: { appenders: ['out'], level: 'debug' }
    }
}

configure(loggerOptions);
let logger: Logger = getLogger();

new KeepAlive(process.argv.slice(2), logger).start();
