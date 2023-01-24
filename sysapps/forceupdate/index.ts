import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { IHaItem } from '../../haitems/ihaitem';
import { HaMain } from '../../hamain';
import { HaParentItem, ServicePromise } from '../../haitems/haparentitem';
import { entityValidator, numberValidator } from '../../common/validator';

const CATEGORY: string = 'ForceUpdate';
var logger: Logger = getLogger(CATEGORY);

type Tracker = {
    entity: IHaItem;
    interval: number;
    timer: NodeJS.Timer;
}

export default class ForceUpdate extends AppParent {
    private _entities: Tracker[] = [];
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
        // Validation of configuration entries
        if (!Array.isArray(config)) {
            logger.error('Input config must be an array');
            return false;
        }
    
        try {
            config.forEach(element => {
                let entity = entityValidator.isValid(element.entity, { entityType: HaParentItem, name: 'entity' });
                let interval = numberValidator.isValid(element.interval, { name: 'interval', floatOk: true, minValue: 1 })
                this._entities.push({ entity: entity, interval: interval, timer: null });
            });
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }

        logger.info('Validated successfully');

        return true;
    }

    async run(): Promise<boolean> {
        let updater = async (tracker: Tracker): Promise<void> => {
            logger.debug(`Updating state of ${tracker.entity.friendlyName}`);
            if (((new Date()).getTime() - tracker.entity.lastUpdated.getTime()) / 1000 / 60 < tracker.interval / 2) {
                logger.debug(`${tracker.entity.friendlyName} state was updated less than ${Math.ceil(tracker.interval / 2)} minutes ago - not updated`);
            }
            else {
                let state: string = tracker.entity.rawState;
                let rc: ServicePromise = await tracker.entity.updateState(state, true);

                if (rc.err) {
                    logger.error(rc.err);
                }
            }
        }
        return new Promise(async (resolve, _reject) => {
            this._entities.forEach((element: Tracker) => {
                element.timer = setInterval(updater, element.interval * 60 * 1000, element);
            });
            resolve(true);
        });
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            this._entities.forEach((element) => clearInterval(element.timer));
            resolve();
        });
    }
}
