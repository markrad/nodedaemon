import { KeepAlive } from "./keepalive";
import { getLogger, Logger } from "log4js";

let logger: Logger = getLogger();

new KeepAlive(process.argv.slice(2), logger).start();
