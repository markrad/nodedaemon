"use strict"
import { Logger } from 'log4js';
import * as schedule from 'node-schedule';
import { AppParent } from '../../common/appparent';
import { entityValidator, stringValidator } from '../../common/validator';
import { HaGenericUpdateableItem } from '../../haitems/hagenericupdatableitem';
import { IHaItemEditable } from "../../haitems/ihaitemeditable";
import { HaMain } from '../../hamain';
import Astro from '../astro';

const CATEGORY = 'AstroHelper';

const logger: Logger = require('log4js').getLogger(CATEGORY);

export default class AstroHelper extends AppParent {
    private _astro: Astro = null;
    private _timezone: string;
    private _lastEvent: IHaItemEditable = null;
    private _lastUpdate: IHaItemEditable = null;
    private _dark: IHaItemEditable = null;
    private _moon: IHaItemEditable = null;
    private _sunrise: IHaItemEditable = null;
    private _sunset: IHaItemEditable = null;
    private _midnight: schedule.Job = null;
    constructor(controller: HaMain) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
        try {
            this._timezone = stringValidator.isValid(config.timezone, { name: 'timezone', noValueOk: true });
            this._lastEvent = entityValidator.isValid(config.lastevent, { entityType: HaGenericUpdateableItem, name: 'lastevent' });
            this._lastUpdate =  entityValidator.isValid(config.lastupdate, { entityType: HaGenericUpdateableItem, name: 'lastupdate' });
            this._dark =  entityValidator.isValid(config.dark, { entityType: HaGenericUpdateableItem,  name: 'dark' });
            this._moon =  entityValidator.isValid(config.moon, { entityType: HaGenericUpdateableItem, name: 'moon' });
            this._sunrise =  entityValidator.isValid(config.sunrise, { entityType: HaGenericUpdateableItem, name: 'sunrise' });
            this._sunset =  entityValidator.isValid(config.sunset, { entityType: HaGenericUpdateableItem, name: 'sunset' });
        }
        catch (err: any) {
            logger.error((err as Error).message);
            return false;
        }

        logger.info('Validated successfully');

        return true;
    }

    async run(): Promise<boolean> {
        return new Promise<boolean>((resolve, _reject) => {
            this.controller.once('appsinitialized', () => {
                if (!(this._astro = this.controller.getApp('Astro')?.instance as Astro)) {
                    logger.error('Astro module has not been loaded - cannot continue');
                    return resolve(false);
                }
                this._astro.on('astroEvent', (event: string) => {
                    let now: Date = new Date();
                    this._lastEvent.updateState(event, false);
                    let nowString: string = now.getFullYear() + '-' +
                        (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                        now.getDate().toString().padStart(2, '0') + ' ' +
                        now.getHours().toString().padStart(2, '0') + ':' +
                        now.getMinutes().toString().padStart(2, '0') + ':' +
                        now.getSeconds().toString().padStart(2, '0');
                    this._lastUpdate.updateState(nowString, false);
                });
                this._astro.on('moonPhase', (phase: any) => this._moon.updateState(phase, false));
                this._astro.on('isLight', () => this._dark.updateState(false, false));
                this._astro.on('isDark', () => this._dark.updateState(true, false))
                this._lastEvent.updateState(this._astro.lastEvent, false);
                let now = new Date();
                let nowString = now.getFullYear() + '-' +
                    (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                    now.getDate().toString().padStart(2, '0') + ' ' +
                    now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0') + ':' +
                    now.getSeconds().toString().padStart(2, '0');
                this._lastUpdate.updateState(nowString, false);
                this._moon.updateState(this._astro.lastMoonPhase, false)
                this._dark.updateState(this._astro.isDark, false);
                this._setsuntimes();
                this._midnight = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._setsuntimes());
            });
            resolve(true);
        });
    }

    private _getEventTime(event: string): string {
        let sr: Date = this._astro.getEvent(event) as Date

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
            this._sunrise.updateState(this._getEventTime('sunrise'), false);
        }

        if (this._sunset) {
            this._sunset.updateState(this._getEventTime('sunset'), false);
        }
    }

    public async stop(): Promise<void> {
        this._midnight.cancel();
    }
}
