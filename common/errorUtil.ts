import { inspect } from 'util';
import { Logger, Level } from 'log4js';

export function dumpError(err: Error, logger: Logger, logLevel: Level | string = 'WARN') {
    logger.log(logLevel, inspect(err));
}