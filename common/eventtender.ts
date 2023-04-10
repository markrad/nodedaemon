import { Logger } from "log4js";

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
                logger.info(`Event ${String(item)} has ${work}`);       // TODO Change this to debug
                count += work;
            });
        }
    }
    catch (err) {
        logger.error(`Failed to iterate events for  ${instance.constructor.name}: ${err}`);
    }

    return count;
}