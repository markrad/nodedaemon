import { Logger } from "log4js";

/**
 * Calculates the total number of event listeners attached to an instance that implements EventEmitter.
 * 
 * @param instance - The instance that implements EventEmitter.
 * @param logger - The logger used for logging warnings and errors.
 * @returns The total number of event listeners attached to the instance.
 * 
 * @ Note This function is for debugging only
 */
export function eventTender(instance: any, logger: Logger): number {
    let count = 0;
    try {
        if (!instance.on) {
            logger.warn(`Instance does not implement EventEmitter: ${instance.constructor.name}`);
        }
        else {
            let events = this.eventNames();
            events.forEach((item: string | Symbol) => {
                let work: number = this.listenerCount(item);
                logger.debug(`Event ${String(item)} has ${work}`);
                count += work;
            });
        }
    }
    catch (err) {
        logger.error(`Failed to iterate events for  ${instance.constructor.name}: ${err}`);
    }

    return count;
}