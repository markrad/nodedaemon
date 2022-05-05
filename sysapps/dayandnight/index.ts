"use strict"
import { Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { IHaItemSwitch } from '../../haitems/haparentitem';
import { HaItemLight } from '../../haitems/haitemlight';
import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
import { HaItemLock } from '../../haitems/haitemlock';
import { HaItemMediaPlayer } from '../../haitems/haitemmedia_player';
import { HaItemBinarySensor } from '../../haitems/haitembinary_sensor';
import { HaMain } from '../../hamain';
// import { IHaItem } from '../../haitems/ihaitem';
import { State } from '../../hamain/state';

const CATEGORY = 'DayAndNight';

const logger: Logger = require('log4js').getLogger(CATEGORY);

export default class DayAndNight extends AppParent {
    private _dayStart: IHaItemSwitch = null;
    private _nightStart: IHaItemSwitch = null;
    private _lights: HaItemLight[] = null;
    // private _switches: IHaItemSwitch[] = null;
    private _locks: HaItemLock[] = null;
    private _echos: HaItemMediaPlayer[] = null;
    private _binarySensors: BinarySensors[] = [];
    private _nightFunc = async (that: IHaItemSwitch, _oldState: State) => {
        this.emit('callservice', 'alexa_media', 'update_last_called');
        let notification: string = '';

        if (that.isOn) {
            let locksUnlocked: HaItemLock[] = this._locks.filter((item) => item.isUnlocked);

            if (locksUnlocked.length == 0) {
                notification += 'All locks are secure. '
            }
            else if (locksUnlocked.length == this._locks.length) {
                notification += 'All locks are insecure. '
            }
            else {
                locksUnlocked.forEach((lock) => notification += `${lock.friendlyName} is <emphasis level="strong">insecure</emphasis>. `)
            }

            let litLights: HaItemLight[] = this._lights.filter((item) => item.isOn);

            if (litLights.length == 0) {
                notification += 'All lights are off. ';
            }
            else if (litLights.length == this._lights.length) {
                notification += 'All lights are on. ';
            }
            else {
                notification += 'The following lights are <emphasis level="strong">on</emphasis>: ';
                litLights.forEach((light, index) => notification += (light.friendlyName + (index + 1 < litLights.length? ', ' : '. ')));
            }
/*
            // TODO: This will require an exclusion facility
            let onSwitches: HaItemLight[] = this._switches.filter((item) => item.isOn);

            if (onSwitches.length == 0) {
                notification += 'All switches are off.';
            }
            else if (onSwitches.length == this._switches.length) {
                notification += 'All switches are on.';
            }
            else {
                notification += 'The following switches are on: ';
                onSwitches.forEach((switch, index) => notification += (switch.friendlyName + (index + 1 < onSwitches.length? ', ' : '. ')));
            }
*/
            this._binarySensors.forEach((binarySensor) => {
                let insecure: HaItemBinarySensor[] = binarySensor.test();

                if (binarySensor.length == 1) {
                    if (insecure.length == 0) {
                        notification += `${binarySensor.singularName} is off. `;
                    }
                    else {
                        notification += `${binarySensor.singularName} is <emphasis level="strong">on</emphasis>. `
                    }
                }
                else {
                    if (insecure.length == 0) {
                        notification += `All ${binarySensor.pluralName} are ${binarySensor.states[0]}. `;
                    }
                    else if (insecure.length == binarySensor.length) {
                        notification += `All ${binarySensor.pluralName} are <emphasis level="strong">${binarySensor.states[1]}</emphasis>. `;
                    }
                    else {
                        notification += `The following ${binarySensor.pluralName} are <emphasis level="strong">${binarySensor.states[1]}</emphasis>: `
                        insecure.forEach((bin, index) => notification += (bin.friendlyName + (index + 1 < insecure.length? ', ' : '. ')));
                    }
                }
            });
            logger.debug('Time');
            await new Promise((resolve) => setTimeout(resolve, 1000));
            let echo = this._echos.find((item: HaItemMediaPlayer) => item.attributes.last_called == true);
            let target = echo != null? echo.name : 'last_called';
            logger.debug(`Target echo is ${target}`);
            this.emit('callservice', 'notify', 'alexa_media_' + target, { message: notification, data: { type: 'tts' } });
            await this._nightStart.turnOff();
        }
    }

    private _dayFunc = (_that: IHaItemSwitch, _oldState: State) => {

    }

    constructor(controller: HaMain) {
        super(controller, logger);
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

        try {
            this._dayStart = this.controller.items.getItemAs<HaGenericSwitchItem>(HaGenericSwitchItem, config.dayStart, true);
            this._nightStart = this.controller.items.getItemAs<HaGenericSwitchItem>(HaGenericSwitchItem, config.nightStart, true);
        }
        catch (err: any) {
            logger.error((err as Error).message);
        }        

        if (!config.echos) {
            logger.error('List of echo devices is required')
            return false;
        }

        if (!Array.isArray(config.echos)) config.echos = [config.echos];

        this._echos = config.echos.map((echo: string) => this.controller.items.getItem('media_player.' + echo))
            .filter((item: HaItemMediaPlayer) => item != null && 'last_called' in item.attributes);

        this._lights = (this.controller.items.getItemByType('light')) as HaItemLight[];
        // this._switches = (this._controller.items.getItemByType('switch')) as HaItemSwitch[];
        this._locks = ((this.controller.items.getItemByType('lock')) as HaItemLock[]).filter((lock) => !lock.attributes.entity_id);

        if (config.binarySensors != null) {
            if (!Array.isArray(config.binarySensors)) {
                logger.error('Binary sensors config entry must be an array');
                return false;
            }

            config.binarySensors.forEach((sensor: any, index: number) => {
                if (!sensor.entities || !sensor.goodState || !sensor.states || !sensor.singularName || !sensor.pluralName) {
                    logger.error(`Binary sensors at index ${index} is missing required elements`);
                    return false
                }

                if (!Array.isArray(sensor.states) || sensor.states.length != 2) {
                    logger.error(`Invalid or missing states at index ${index}`);
                }

                let entities: HaItemBinarySensor[] = sensor.entities.map((entity: string) => this.controller.items.getItem(('binary_sensor.' + entity)));

                if (entities.length == 0) {
                    logger.error(`No valid enitites found at index ${index}`);
                    return false;
                }

                this._binarySensors.push(new BinarySensors(entities, sensor.goodState, sensor.singularName, sensor.pluralName, sensor.states));
            });
        }

        logger.info('Validated successfully');

        return true;
    }

    async run(): Promise<boolean> {

        await this._nightStart.turnOff();
        await this._dayStart.turnOff();

        this._nightStart.on('new_state', this._nightFunc);
        this._dayStart.on('new_state', this._dayFunc);

        return true;
    }

    public async stop(): Promise<void> {
        this._nightStart.off('new_state', this._nightFunc);
        this._dayStart.off('new_state', this._dayFunc);
    }
}

class BinarySensors {
    private _entities: HaItemBinarySensor[] = null;
    private readonly _goodState: string;
    private readonly _singlarName: string;
    private readonly _pluralName: string;
    private readonly _states: string[];
    constructor(entities: HaItemBinarySensor[], goodState: string, singularName: string, pluralName: string, states: string[]) {
        this._entities = entities;
        this._goodState = goodState;
        this._singlarName = singularName;
        this._pluralName = pluralName;
        this._states = states;
    }

    test(): HaItemBinarySensor[] {
        return this._entities.filter((entity: HaItemBinarySensor) => entity.state != this._goodState);
    }

    get length() {
        return this._entities.length;
    }

    get singularName() {
        return this._singlarName;
    }

    get pluralName() {
        return this._pluralName;
    }

    get states() {
        return this._states;
    }
}