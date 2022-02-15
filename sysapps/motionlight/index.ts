"use strict";

import { IHaItem } from "../../haitems/ihaitem";
import { IHaItemSwitch } from "../../haitems/haparentitem";
import { HaMain } from "../../hamain";
import { State } from '../../hamain/state';
import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import * as HaItemBinarySensor from "../../haitems/haitembinary_sensor";

interface KillSwitch {
    entity: IHaItem;
    op: string;
    comperand: string | number | boolean;
}
interface Trip {
    sensor: IHaItem;
    lights: IHaItemSwitch[];
    timeout: number;
    killswitch?: KillSwitch;
}

const CATEGORY = 'MotionLight';
var logger: Logger = getLogger(CATEGORY);

export default class MotionLight extends AppParent {
    private _controller: HaMain;
    private _actioners: actioner[] = [];
    private _trips: Trip[] = null;
    constructor(controller: HaMain) {
        super(logger);
        this._controller = controller;
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        const ops: string[] = ['eq', 'ne', 'lt', 'le', 'gt', 'ge'];
        if (!config) {
            logger.error('No devices specified');
        }
        else {
            if (!Array.isArray(config)) {
                logger.error('Invalid device specification');
                return false;
            }
            this._trips = config.map((value: any) => {
                if (value.sensor == undefined) {
                    logger.error('Entry does not contain a sensor');
                    return null
                }
                if (value.switch == undefined) {
                    logger.error('Entry does not contain any switches');
                    return null;
                }
                if (value.delay == undefined) {
                    logger.error('Entry does not contain a delay');
                    return null;
                }
                if (typeof value.delay != 'number') {
                    logger.error('Delay must be a number');
                    return null;
                }
                if (null == this._controller.items.getItemAs((HaItemBinarySensor as any).default, value.sensor)) {
                    logger.error(`Sensor ${value.sensor} is either missing or not a binary_sensor type`);
                    return null;
                }
                if (!Array.isArray(value.switch)) {
                    value.switch = [ value.switch ];
                }
                if (value.killswitch) {
                    if (!ops.includes(value.killswitch.operator)) {
                        logger.error(`Invalid operator ${value.killswitch.op} passed`);
                        return null;
                    }
                    if (!value.killswitch.entity || null == this._controller.items.getItem(value.killswitch.entity)) {
                        logger.error(`Killswitch entity ${value.killswitch.entity} does not exist`);
                        return null;
                    }
                    if (!('comperand' in value.killswitch)) {
                        logger.error('Killswitch is missing comperand');
                        return null;
                    }
                }
                if (false == value.switch.reduce((flag: boolean, value: string) => {
                    if (!this._controller.items.getItem(value)) {
                        logger.error(`Specified target light does not exist: ${value}`);
                        flag = false;
                    }
                    else if (!this._controller.items.getItem(value).isSwitch) {
                        logger.error(`Specified target light is not a switch or a light: ${value}`);
                        flag = false;
                    }

                    return flag;
                }, true)) {
                    logger.error(`Invalid lights found in target array`);
                    return null;
                }
                else {
                    let lights: IHaItemSwitch[] = value.switch.map((value: string) => this._controller.items.getItem(value));
                    let trip: Trip = { 
                        sensor: this._controller.items.getItem(value.sensor),
                        lights: lights,
                        timeout: value.delay
                    };
                    if (value.killswitch) {
                        trip.killswitch = {
                            entity: value.killswitch.entity,
                            op: value.killswitch.operator,
                            comperand: value.killswitch.comperand
                        }
                    }
                    return trip;
                }
            }).filter((item: Trip) => item != null);
            logger.info('Validated successfully');

            return true;
        }
    }

    public async run(): Promise<boolean> {
        if (this._trips == null || this._trips.length == 0) {
            let err = new Error('No valid device pairs found');
            logger.warn(err.message);
            throw err;
        }

        this._trips.forEach((trip) => this._actioners.push(new actioner(trip)));

        return true;
    }

    public async stop() {
        this._actioners.forEach(actioner => {
            actioner.stop();
        });
    }
}

class actioner {
    private _trip: Trip;
    private _timer: NodeJS.Timer = null;
    private _eventHandler: (that: IHaItem, oldState: State) => void;
    public constructor(trip: Trip) {
        this._trip = trip;
        this._timer = null;

        this._eventHandler = (that: IHaItem, _oldState: State) => {
            logger.debug(`State ${that.state} triggered on ${this._trip.sensor.entityId} for ${this._trip.lights.map(item => item.entityId).join(' ')}`);
            if (that.state == 'on' && !this.shouldIgnore(this._trip.killswitch)) {
                this._trip.lights.forEach((light: IHaItemSwitch) => {
                    light.turnOffAt(Date.now() + this._trip.timeout * 60 * 1000);
                });
                this._timer = setInterval(() => 
                { 
                    if (!this._trip.lights[0].isTimerRunning) {
                        clearInterval(this._timer);
                        this._timer = null;
                    }
                    else if (this._trip.sensor.state == 'on') {
                        logger.trace(`Checking motion sensor status: ${this._trip.sensor.state}`);
                        this._trip.lights.forEach((light) => {
                            logger.debug('Extenting turn off time');
                            light.turnOffAt(Date.now() + this._trip.timeout * 60 * 1000);
                        });
                    }
                }, 30000);
            }
            else {
                clearInterval(this._timer);
                this._timer = null;
            }
        }
        this._trip.sensor.on('new_state', this._eventHandler); 
    }

    public async stop(): Promise<void> {
        this._trip.sensor.off('new_state', this._eventHandler);
    }

    private shouldIgnore(killswitch: KillSwitch): boolean {
        if (!killswitch) {
            return false;
        }

        switch (killswitch.op) {
            case 'eq':
                return killswitch.entity.state == killswitch.comperand;
                break;
            case 'ne':
                return killswitch.entity.state != killswitch.comperand;
                break;
            case 'lt':
                return killswitch.entity.state < killswitch.comperand;
                break;
            case 'le':
                return killswitch.entity.state <= killswitch.comperand;
                break;
            case 'gt':
                return killswitch.entity.state > killswitch.comperand;
                break;
            case 'ge':
                return killswitch.entity.state >= killswitch.comperand;
                break;
        }
    }
}
