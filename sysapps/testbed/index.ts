import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaMain /*, SensorType */ } from '../../hamain';
// import { HaItemSensor } from '../../haitems/haitemsensor'
// import { IHaItemEditable } from '../../haitems/haparentitem';
// import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
// import { resolve } from 'path';
// import  HaItemUpdate from '../../haitems/haitemupdate';
// import { HaGenericBinaryItem } from '../../haitems/hagenericbinaryitem';
import Astro from '../astro';

const CATEGORY: string = 'TestBed';
var logger: Logger = getLogger(CATEGORY);

export default class TestBed extends AppParent {
    private _astro2: Astro;
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(_config: any): boolean {
        // Since this is test code we don't do much in here
        logger.info('Validated successfully')
        return true;
    }

    async run(): Promise<boolean> {
        return new Promise(async (resolve, _reject) => {
            this.controller.once('appsinitialized', () => {
                if (!(this._astro2 = this.controller.getApp('Astro')?.instance as Astro)) {
                    logger.error('Astro module has not been loaded - cannot continue');
                    return resolve(false);
                }
                this._astro2.on('astroEvent', (event) => logger.debug(`Astro event: ${event} fired`));
                this._astro2.on('isDark', () => logger.debug('isDark'));
                this._astro2.on('isLight', () => logger.debug('isLight'));
                this._astro2.on('moonPhase', (event) => logger.debug(`Moon phase event: ${event} fired`));
                logger.debug(`Is dark? ${this._astro2.isDark}`);
                logger.debug(`Is light? ${this._astro2.isLight}`);
                logger.debug(`Last Event: ${this._astro2.lastEvent}`);
                logger.debug(`Moon phase: ${this._astro2.lastMoonPhase}`);
            });
            resolve(true);
        });
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            resolve();
        });
    }
}
