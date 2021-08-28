"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const log4js_1 = require("log4js");
const CATEGORY = 'MotionLight';
var logger = log4js_1.getLogger(CATEGORY);
class MotionLight {
    constructor(controller) {
        this._actioners = [];
        this._trips = null;
        this._controller = controller;
    }
    validate(config) {
        if (!config.devices) {
            logger.error('No devices specified');
        }
        else {
            if (!Array.isArray(config.devices)) {
                logger.error('Invalid device specification');
                return false;
            }
            this._trips = config.devices.map((value) => {
                if (!Array.isArray(value)) {
                    logger.error(`Specified value is not an array: ${value}`);
                }
                if (!Array.isArray(value[1])) {
                    value[1] = [value[1]];
                }
                if (!this._controller.items.getItem(value[0])) {
                    logger.error(`Specified motion sensor does not exist: ${value[0]}`);
                }
                else if (this._controller.items.getItem(value[0]).type != 'binary_sensor') {
                    logger.error(`Specified motion sensor needs to be type binary_sensor: ${value[0]}`);
                }
                else if (false == value[1].reduce((flag, value) => {
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
                else if (typeof (value[2]) != 'number') {
                    logger.error(`Minutes before action is not numeric`);
                }
                else {
                    let lights = value[1].map((value) => this._controller.items.getItem(value));
                    let trip = {
                        sensor: this._controller.items.getItem(value[0]),
                        lights: lights,
                        timeout: value[2]
                    };
                    return trip;
                }
            }).filter((item) => item != undefined);
            logger.info('Constructed');
            return true;
        }
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._trips == null || this._trips.length == 0) {
                let err = new Error('No valid device pairs found');
                logger.warn(err.message);
                throw err;
            }
            this._trips.forEach((trip) => this._actioners.push(new actioner(trip)));
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            this._actioners.forEach(actioner => {
                actioner.stop();
            });
        });
    }
}
class actioner {
    constructor(trip) {
        this._timer = null;
        this._trip = trip;
        this._timer = null;
        this._eventHandler = (that, _oldState) => {
            logger.debug(`State ${that.state} triggered on ${this._trip.sensor.entityId} for ${this._trip.lights.map(item => item.entityId).join(' ')}`);
            if (that.state == 'on') {
                this._trip.lights.forEach((light) => {
                    light.turnOffAt(Date.now() + this._trip.timeout * 60 * 1000);
                });
                this._timer = setInterval(() => {
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
        };
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
//# sourceMappingURL=index.js.map