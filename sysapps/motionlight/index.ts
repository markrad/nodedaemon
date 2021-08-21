"use strict";

import { HaParentItem, IHaItem, IHaItemSwitch } from "../../haitems/haparentitem";
import { HaMain, State } from "../../hamain";
import { getLogger } from 'log4js'

// TODO Minimum conversion

type TripTarget = {
    Targets: IHaItemSwitch[];
    Timeout: number;
}

type Trip = {
    Sensor: IHaItem;
    TripTargets: TripTarget[];
}

const CATEGORY = 'MotionLight';
var logger = getLogger(CATEGORY);

class MotionLight {
    controller: HaMain;
    actioners: actioner[]
    trips: Trip[];
    constructor(controller: HaMain) {
        this.controller = controller;
        this.actioners = [];
        this.trips = null;
    }

    validate(config: any) {
        if (!config.devices) {
            logger.error('No devices specified');
        }
        else {
            if (!Array.isArray(config.devices)) {
                logger.error('Invalid device specification');
                return false;
            }
            this.trips = config.devices.map((value: any[]) => {
                if (!Array.isArray(value)) {
                    logger.error(`Specified value is not an array: ${value}`);
                }
                if (!Array.isArray(value[1])) {
                    value[1] = [ value[1] ];
                }
                if (!this.controller.items.getItem(value[0])) {
                    logger.error(`Specified motion sensor does not exist: ${value[0]}`);
                }
                else if (this.controller.items.getItem(value[0]).type != 'binary_sensor') {
                    logger.error(`Specified motion sensor needs to be type binary_sensor: ${value[0]}`)
                }
                else if (false == value[1].reduce((flag, value) => {
                    if (!this.controller.items.getItem(value)) {
                        logger.error(`Specified target light does not exist: ${value}`);
                        flag = false;
                    }
                    else if (!this.controller.items.getItem(value).isSwitch) {
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
                    let lights: HaParentItem[] = value[1].map((value) => this.controller.items.getItem(value));
                    return [ this.controller.items.getItem(value[0]), lights, value[2]];
                }
            }).filter(item => item != undefined);
            logger.info('Constructed');

            return true;
        }
    }

    async run() {
        if (this.trips == null || this.trips.length == 0) {
            let err = new Error('No valid device pairs found');
            logger.warn(err.message);
            throw err;
        }

        this.trips.forEach((trip) => this.actioners.push(new actioner(trip)));
    }

    async stop() {
        this.actioners.forEach(actioner => {
            actioner.stop();
        });
    }
}

class actioner {
    trip: Trip;
    timer: NodeJS.Timer;
    eventHandler: (that: IHaItem, oldState: State) => void;
    constructor(trip: Trip) {
        this.trip = trip;
        this.timer = null;

        this.eventHandler = (that: IHaItem, _oldState: State) => {
            logger.debug(`State ${that.state} triggered on ${this.trip[0].entityId} for ${this.trip[1].map(item => item.entityId).join(' ')}`);
            if (that.state == 'on') {
                this.trip[1].forEach((light: IHaItemSwitch) => {
                    light.turnOffAt(Date.now() + this.trip[2] * 60 * 1000);
                });
                this.timer = setInterval(() => 
                { 
                    if (!this.trip[1][0].isTimerRunning) {
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                    else if (this.trip[0].state == 'on') {
                        logger.trace(`Checking motion sensor status: ${this.trip[0].state}`);
                        this.trip[1].forEach((light) => {
                            logger.debug('Extenting turn off time');
                            light.turnOffAt(Date.now() + this.trip[2] * 60 * 1000);
                        });
                    }
                }, 30000);
            }
            else {
                clearInterval(this.timer);
                this.timer = null;
            }
        }
        // this.eventHandler.trip = this.trip;
        // this.eventHandler.timer = null;
        this.trip[0].on('new_state', this.eventHandler); 
    }

    stop() {
        this.trip[0].off('new_state', this.eventHandler);
    }
}

module.exports = MotionLight;