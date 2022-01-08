import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaMain, SensorType } from '../../hamain';
// import { HaItemSensor } from '../../haitems/haitemsensor'
import { IHaItemEditable } from '../../haitems/haparentitem';
import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';

const CATEGORY: string = 'TestBed';
var logger: Logger = getLogger(CATEGORY);

export default class TestBed extends AppParent {
    private _controller: HaMain;
    constructor(controller: HaMain, _config: any) {
        super(logger);
        this._controller = controller;
        logger.info('Constructed');
    }

    validate(_config: any): boolean {
        // Since this is test code we don't do much in here
        let a: HaGenericSwitchItem = this._controller.items.getItemAs(HaGenericSwitchItem, 'light.marks_light') as HaGenericSwitchItem;
        let b: HaGenericSwitchItem = this._controller.items.getItemAs(HaGenericSwitchItem, 'sensor.bedroom_nightstand_1_battery_level') as HaGenericSwitchItem;
        logger.debug(a);
        logger.debug(b);
        logger.info('Validated successfully')
        return true;
    }

    async run(): Promise<boolean> {
        return new Promise(async (resolve, _reject) => {
            let name: string = 'testbed_' + Math.floor(Math.random() * 10000).toString();
            try {
                await this._controller.addSensor(name, SensorType.normal, 'testbed1');
                ((this._controller.items.getItem(`sensor.${name}`)) as IHaItemEditable).updateState('testbed2'); 
                resolve(true);
            }
            catch (err) {
                logger.error(`Failed to add sensor ${name}: ${err.message}`)
            }
        });
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            resolve();
        });
    }
}
