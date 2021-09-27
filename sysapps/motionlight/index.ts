"use strict";

import { IHaItem } from "../../haitems/ihaitem";
import { IHaItemSwitch } from "../../haitems/haparentitem";
import { HaMain, State } from "../../hamain";
import { getLogger } from 'log4js';
import { IApplication } from "../../common/IApplication";
import { LogLevelValidator } from '../../common/loglevelvalidator';

interface Trip {
    sensor: IHaItem;
    lights: IHaItemSwitch[]
    timeout: number;
}

const CATEGORY = 'MotionLight';
var logger = getLogger(CATEGORY);

class MotionLight implements IApplication {
    private _controller: HaMain;
    private _actioners: actioner[] = [];
    private _trips: Trip[] = null;
    constructor(controller: HaMain) {
        this._controller = controller;
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        if (!config.devices) {
            logger.error('No devices specified');
        }
        else {
            if (!Array.isArray(config.devices)) {
                logger.error('Invalid device specification');
                return false;
            }
            this._trips = config.devices.map((value: any[]) => {
                if (!Array.isArray(value)) {
                    logger.error(`Specified value is not an array: ${value}`);
                }
                if (!Array.isArray(value[1])) {
                    value[1] = [ value[1] ];
                }
                if (!this._controller.items.getItem(value[0])) {
                    logger.error(`Specified motion sensor does not exist: ${value[0]}`);
                }
                else if (this._controller.items.getItem(value[0]).type != 'binary_sensor') {
                    logger.error(`Specified motion sensor needs to be type binary_sensor: ${value[0]}`)
                }
                else if (false == value[1].reduce((flag: boolean, value: string) => {
                    if (!this._controller.items.getItem(value)) {
                        logger.error(`Specified target light does not exist: ${value}`);
                        flag = false;
                    }
                    else if (!this._controller.items.getItem(value).isSwitch) {
                        logger.error(`Specified target light is not a switch or a light: ${value[1]}`);
                        flag = false;
                    }

                    return flag;
                }, true)) {
                    logger.error(`Invalid lights found in target array`);
                }
                else if (typeof(value[2]) != 'number') {
                    logger.error(`Minutes before action is not numeric`);
                }
                else {
                    let lights: IHaItemSwitch[] = value[1].map((value: string) => this._controller.items.getItem(value));
                    let trip: Trip = { 
                        sensor: this._controller.items.getItem(value[0]),
                        lights: lights,
                        timeout: value[2]
                    };
                    return trip;
                }
            }).filter((item: Trip) => item != undefined);
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

    public get logging(): string {
        return logger.level;
    }

    public set logging(value: string) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            logger.error(err.message);
            throw err;
        }
        else {
            logger.level = value;
        }
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
            if (that.state == 'on') {
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

    // private _eventHandler(that: IHaItem, _oldState: State): void {
    //     logger.debug(`State ${that.state} triggered on ${this._trip.sensor.entityId} for ${this._trip.lights.map(item => item.entityId).join(' ')}`);
    //     if (that.state == 'on') {
    //         this._trip.lights.forEach((light: IHaItemSwitch) => {
    //             light.turnOffAt(Date.now() + this._trip.timeout * 60 * 1000);
    //         });
    //         this._timer = setInterval(() => 
    //         { 
    //             if (!this._trip.lights[0].isTimerRunning) {
    //                 clearInterval(this._timer);
    //                 this._timer = null;
    //             }
    //             else if (this._trip.sensor.state == 'on') {
    //                 logger.trace(`Checking motion sensor status: ${this._trip.sensor.state}`);
    //                 this._trip.lights.forEach((light) => {
    //                     logger.debug('Extending turn off time');
    //                     light.turnOffAt(Date.now() + this._trip.timeout * 60 * 1000);
    //                 });
    //             }
    //         }, 30000);
    //     }
    //     else {
    //         clearInterval(this._timer);
    //         this._timer = null;
    //     }
    // }

    stop() {
        this._trip.sensor.off('new_state', this._eventHandler);
    }
}

module.exports = MotionLight;