import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaMain /*, SensorType */ } from '../../hamain';
// import { HaItemSensor } from '../../haitems/haitemsensor'
// import { IHaItemEditable } from '../../haitems/haparentitem';
// import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
// import { resolve } from 'path';
import { HaItemUpdate } from '../../haitems/haitemupdate';

const CATEGORY: string = 'TestBed';
var logger: Logger = getLogger(CATEGORY);

export default class TestBed extends AppParent {
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(_config: any): boolean {
        // Since this is test code we don't do much in here
        let x: HaItemUpdate = (this.controller.items.getItem('update.rr_synol1_dsm_update') as HaItemUpdate);
        logger.debug(x.state);
        logger.debug(`isOn=${x.isOn}; isOff=${x.isOff}`);
        // let a: HaGenericSwitchItem = this.controller.items.getItemAs<HaGenericSwitchItem>(HaGenericSwitchItem, 'light.marks_light');
        // let b: HaGenericSwitchItem = this.controller.items.getItemAs<HaGenericSwitchItem>(HaGenericSwitchItem, 'sensor.bedroom_nightstand_1_battery_level');
        // logger.debug(a);
        // logger.debug(b);
        // logger.info('Validated successfully')
        return true;
    }

    async run(): Promise<boolean> {
        return new Promise(async (resolve, _reject) => {
        //     let name: string = 'testbed_' + Math.floor(Math.random() * 10000).toString();
        //     try {
        //         await this.controller.addSensor(name, SensorType.normal, 'testbed1');
        //         ((this.controller.items.getItem(`sensor.${name}`)) as IHaItemEditable).updateState('testbed2'); 
        //         resolve(true);
        //     }
        //     catch (err) {
        //         logger.error(`Failed to add sensor ${name}: ${err.message}`)
        //     }
        // });
            resolve(true);
        });
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            resolve();
        });
    }
}
