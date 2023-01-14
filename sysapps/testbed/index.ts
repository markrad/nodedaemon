import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaMain /*, SensorType */ } from '../../hamain';
import { IHaItem } from '../../haitems/ihaitem';
// import { HaItemSensor } from '../../haitems/haitemsensor'
// import { IHaItemEditable } from '../../haitems/haparentitem';
// import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
// import { resolve } from 'path';
// import  HaItemUpdate from '../../haitems/haitemupdate';
// import { HaGenericBinaryItem } from '../../haitems/hagenericbinaryitem';
// import Astro from '../astro';

const CATEGORY: string = 'TestBed';
var logger: Logger = getLogger(CATEGORY);

export default class TestBed extends AppParent {
    // private _astro: Astro;
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
        // Since this is test code we don't do much in here
        let test: IHaItem[] = this.controller.items.getItemsAsArray();
        let counters = {
            number: 0,
            string: 0,
            boolean: 0,
            other: 0
        }
        test.forEach((item) => {
            switch(typeof item.state) {
                case 'string': 
                    counters.string++;
                break;
                case 'number':
                    counters.number++;
                break;
                case 'boolean':
                    counters.boolean++;
                break;
                default:
                    counters.other++;
                break;
            }
        })
        logger.debug('string: \t' + counters.string);
        logger.debug('number: \t' + counters.number);
        logger.debug('boolean:\t' + counters.boolean);
        logger.debug('other:  \t' + counters.other);
        logger.info('Validated successfully')
        return true;
    }

    async run(): Promise<boolean> {
        return new Promise(async (resolve, _reject) => {
            resolve(true);
        });
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            resolve();
        });
    }
}
