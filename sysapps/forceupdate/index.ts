import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { IHaItem } from '../../haitems/ihaitem';
import { HaMain } from '../../hamain';

const CATEGORY: string = 'ForceUpdate';
var logger: Logger = getLogger(CATEGORY);

type Tracker = {
    entity: IHaItem;
    interval: number;
    timer: NodeJS.Timer;
}

export default class ForceUpdate extends AppParent {
    private entities: Tracker[] = [];
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        // Validation of configuration entries
        if (!Array.isArray(config)) {
            logger.error('Input config must be an array');
            return false;
        }
    
        config.forEach(element => {
            if (!element.entity || !element.interval) {
                logger.error('Each element requires an entity and an interval');
                return false;
            }
            
            let entity = this.controller.items.getItem(element.entity);

            if (!entity) {
                logger.error(`Entity ${element.entity} does not exist`);
                return false;
            }

            let interval: number = parseFloat(element.interval);

            if (interval == NaN || interval <= 0) {
                logger.error(`Entity ${element.entity} has an invalid interval ${element.interval}`);
                return false;
            }
            this.entities.push({ entity: entity, interval: interval, timer: null });
        });

        logger.info('Validated successfully');

        return true;
    }

    async run(): Promise<boolean> {
        let updater = (tracker: Tracker): void => {
            logger.debug(`Updating state of ${tracker.entity.friendlyName}`);
        }
        return new Promise(async (resolve, _reject) => {
            this.entities.forEach((element: Tracker) => {
                element.timer = setInterval(updater, element.interval * 60 * 1000, element);
            });
            resolve(true);
        });
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            this.entities.forEach((element) => clearInterval(element.timer));
            resolve();
        });
    }
}
