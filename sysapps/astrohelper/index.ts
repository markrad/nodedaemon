"use strict"
import { Logger } from 'log4js';
import * as schedule from 'node-schedule';
import { AppParent } from '../../common/appparent';
import { IHaItemEditable, SafeItemAssign } from '../../haitems/haparentitem';
import { HaMain } from '../../hamain';

const CATEGORY = 'AstroHelper';

const logger: Logger = require('log4js').getLogger(CATEGORY);

export default class AstroHelper extends AppParent {
    private _controller: HaMain = null;
    private _astro: any = null;
    private _lastEvent: IHaItemEditable = null;
    private _lastUpdate: IHaItemEditable = null;
    private _dark: IHaItemEditable = null;
    private _moon: IHaItemEditable = null;
    private _sunrise: IHaItemEditable = null;
    private _sunset: IHaItemEditable = null;
    private _midnight: schedule.Job = null;
    constructor(controller: HaMain) {
        super(logger);
        this._controller = controller;
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        if (config.logLevel) {
            try {
                this.logging = config.logLevel;
                logger.info(`Set log level to ${config.logLevel}`);
            }
            catch (err: any) {
                logger.error(`Failed to set log level to ${config.logLevel}`);
            }
        }

        if (!(this._lastEvent = SafeItemAssign(this._controller.items.getItem(config.lastevent)))) {
            logger.error(`Last Event variable does not exist or is not updatable: ${config.lastEvent}`);
            return false;
        }
        if (!(this._lastUpdate = SafeItemAssign(this._controller.items.getItem(config.lastupdate)))) {
            logger.error(`Last Update variable does not exist or is not updateable: ${config.lastupdate}`);
            return false;
        }
        if (!(this._dark = SafeItemAssign(this._controller.items.getItem(config.dark)))) {
            logger.error(`Is It dark variable does not exist or is not updatable: ${config.dark}`);
            return false;
        }
        if (!(this._moon = SafeItemAssign(this._controller.items.getItem(config.moon)))) {
            logger.error(`Moon phase variable does not exist or is not updatable: ${config.moon}`);
            return false;
        }
        if (!(this._sunrise = SafeItemAssign(this._controller.items.getItem(config.sunrise)))) {
            logger.error(`Sunrise variable does not exist : ${config.sunrise}`);
            return false;
        }
        if (!(this._sunset = SafeItemAssign(this._controller.items.getItem(config.sunset)))) {
            logger.error(`Sunset variable does not exist : ${config.sunset}`);
            return false;
        }

        logger.info('Validated successfully');

        return true;
    }

    async run(): Promise<boolean> {
        
        if (!(this._astro = this._controller.getApp('Astro')?.instance)) {
            logger.error('Astro module has not been loaded - cannot continue');
            return false;
        }

        this._astro.once('initialized', () => {
            this._astro.on('astroevent', (event: string) => {
                let now: Date = new Date();
                this._lastEvent.updateState(event);
                let nowString: string = now.getFullYear() + '-' +
                    (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                    now.getDate().toString().padStart(2, '0') + ' ' +
                    now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0') + ':' +
                    now.getSeconds().toString().padStart(2, '0');
                this._lastUpdate.updateState(nowString);
            });
            this._astro.on('moonphase', (phase: any) => this._moon.updateState(phase));
            this._astro.on('isLight', () => this._dark.updateState(false));
            this._astro.on('isDark', () => this._dark.updateState(true))
            this._lastEvent.updateState(this._astro.lastEvent);
            let now = new Date();
            let nowString = now.getFullYear() + '-' +
                (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                now.getDate().toString().padStart(2, '0') + ' ' +
                now.getHours().toString().padStart(2, '0') + ':' +
                now.getMinutes().toString().padStart(2, '0') + ':' +
                now.getSeconds().toString().padStart(2, '0');
            this._lastUpdate.updateState(nowString);
            this._moon.updateState(this._astro.lastMoonPhase)
            this._dark.updateState(this._astro.isDark);
            this._setsuntimes();
            this._midnight = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._setsuntimes());
        });
        return true;
    }

    private _getEventTime(event: string): string {
        let sr = this._astro.getEvent(event)

        if (!sr) {
            logger.error(`Specified event ${event} was not found`);
            return null;
        }
        else {
            let ret = sr.getFullYear() + '-' +
                (sr.getMonth() + 1).toString().padStart(2, '0') + '-' +
                sr.getDate().toString().padStart(2, '0') + ' ' +
                sr.getHours().toString().padStart(2, '0') + ':' +
                sr.getMinutes().toString().padStart(2, '0') + ':' +
                sr.getSeconds().toString().padStart(2, '0');
            logger.debug(`Setting ${event} to ${ret}`);
            return ret;
        }
    }

    private _setsuntimes(): void {
        if (this._sunrise) {
            this._sunrise.updateState(this._getEventTime('sunrise'));
        }

        if (this._sunset) {
            this._sunset.updateState(this._getEventTime('sunset'));
        }
    }

    public async stop(): Promise<void> {
        this._midnight.cancel();
    }
}
