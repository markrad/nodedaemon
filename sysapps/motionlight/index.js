var log4js = require('log4js');
const { isArguments, isArray } = require('underscore');

const CATEGORY = 'MotionLight';
var logger = log4js.getLogger(CATEGORY);

class MotionLight {
    constructor(controller, config) {
        this.execute = true;
        this.actioners = [];
        this.trips = null;
        if (!config.MotionLight) {
            logger.debug('No config specified');
            this.execute = false;
        }
        else if (!config?.MotionLight.devices) {
            logger.error('No devices specified');
        }
        else {
            if (!isArray(config.MotionLight.devices)) {
                logger.error('Invalid device specification');
                return;
            }
            this.trips = config.MotionLight.devices.map((value) => {
                if (!isArray(value[1])) {
                    value[1] = [ value[1] ];
                }
                if (!isArray(value)) {
                    logger.error(`Specified value is not an array: ${value}`);
                }
                else if (!controller.items[value[0]]) {
                    logger.error(`Specified motion sensor does not exist: ${value[0]}`);
                }
                else if (controller.items[value[0]].type != 'binary_sensor') {
                    logger.error(`Specified motion sensor needs to be type binary_sensor: ${value[0]}`)
                }
                else if (false == value[1].reduce((flag, value) => {
                    if (!controller.items[value]) {
                        logger.error(`Specified target light does not exist: ${value}`);
                        flag = false;
                    }
                    else if (!controller.items[value].isSwitch) {
                        logger.error(`Specified target light is not a switch or a light: ${value[1]}`);
                        flag = false;
                    }

                    return flag;
                    // else {
                    //     return true;
                    // }
                }, true)) {
                    logger.error(`No valid lights found in target array`);
                }
                else if (typeof(value[2]) != 'number') {
                    logger.error(`Minutes before action is not numeric`);
                }
                else {
                    let lights = value[1].map((value) => controller.items[value]);
                    return [ controller.items[value[0]], lights, value[2]];
                }
            }).filter(item => item != undefined);
            logger.info('Constructed');
        }
    }

    async run() {
        if (this.execute == false) {
            let err = new Error('No config found - run request ignored');
            logger.info(err.message);
            throw err;
        }
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
    constructor(trip) {
        this.trip = trip;
        this.timer = null;

        this.eventHandler = (that, _oldState) => {
            logger.debug(`State ${that.state} triggered on ${this.trip[0].entityId} for ${this.trip[1].map(item => item.entityId).join(' ')}`);
            if (that.state == 'on') {
                this.trip[1].forEach((light) => {
                    light.turnOffAt(Date.now() + this.trip[2] * 60 * 1000);
                });
                this.timer = setInterval(() => 
                { 
                    if (!this.trip[1][0].isTimerRunning) {
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                    else if (this.trip[0].state == 'on') {
                        this.trip[1].forEach((light) => {
                            light.turnOffAt(Date.now() + this.trip[2] * 60 * 1000);
                        });
                    }
                }, 10000);
            }
            else {
                clearInterval(this.timer);
                this.timer = null;
            }
        }
        this.eventHandler.trip = this.trip;
        this.eventHandler.timer = null;
        this.trip[0].on('new_state', this.eventHandler); 
    }

    stop() {
        this.trip[0].off('new_state', this.eventHandler);
    }
}

module.exports = MotionLight;