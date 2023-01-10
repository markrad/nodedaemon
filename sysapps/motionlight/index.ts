"use strict";

import { IHaItem } from "../../haitems/ihaitem";
import { IHaItemSwitch } from "../../haitems/IHaItemSwitch";
import { HaMain } from "../../hamain";
import { State } from '../../hamain/state';
import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { entityValidator, numberValidator } from "../../common/validator";
import { HaGenericSwitchItem } from "../../haitems/hagenericswitchitem";
import { HaParentItem } from "../../haitems/haparentitem";
import { HaGenericBinaryItem } from "../../haitems/hagenericbinaryitem";

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
    private _actioners: actioner[] = [];
    private _trips: Trip[] = null;
    constructor(controller: HaMain) {
        super(controller, logger);
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
                try {
                    let sensor: HaGenericBinaryItem;
                    let delay: number;
                    let op: string = null;
                    let comp: string | number | boolean;
                    let killEntity: HaParentItem = null;
                    if (!(sensor = entityValidator.isValid(value.sensor, { entityType: HaGenericBinaryItem }))) throw new Error('Entry does not contain a sensor');
                    if (value.switch == undefined) throw new Error('Entry does not contain any switches');
                    if (!(delay = numberValidator.isValid(value.delay, { minValue: 0, floatOk: true }))) throw new Error('Entry does not contain a delay');
                    if (!Array.isArray(value.switch)) value.switch = [ value.switch ];

                    if (value.killswitch) {
                        if (!ops.includes(value.killswitch.operator)) throw new Error(`Invalid operator ${value.killswitch.op} passed`);
                        op = value.killswitch.operator;
                        if (!value.killswitch.comperand) throw new Error('Killswitch is missing comperand');
                        comp = value.killswitch.comperand;
                        // if (!('comperand' in value.killswitch)) throw new Error('Killswitch is missing comperand');
                        if (!(killEntity = entityValidator.isValid(value.killswitch.killEntity, { entityType: HaParentItem }))) throw new Error(`Killswitch entity ${value.killswitch.entity} does not exist`);

                    }
                    let lights: HaGenericSwitchItem[] = (value.switch as Array<string>).map((value: string) => {
                        let tempsw: HaGenericSwitchItem;
                        if (!(tempsw = entityValidator.isValid(value, { entityType: HaGenericSwitchItem }))) throw new Error(`Specified target light is not a switch or a light: ${value}`);
                        return tempsw;
                    })
                    let trip: Trip = {
                        sensor: sensor,
                        lights: lights,
                        timeout: delay
                    }
                    if (killEntity) {
                        trip.killswitch = {
                            entity: killEntity,
                            op: op,
                            comperand: comp
                        }
                    }

                    return trip;
                }
                catch (err) {
                    logger.error(err.message);
                    return null;
                }
            }).filter((item: Trip) => item != null);

            if (this._trips.length == 0) {
                logger.error('No valid entries found');
                return false;
            }

            logger.info('Validated successfully');

            return true;
        }
    }

    public async run(): Promise<boolean> {

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

        let state = this._getStateAsType(killswitch.entity.state, killswitch.comperand);

        switch (killswitch.op) {
            case 'eq':
                return state == killswitch.comperand;
                break;
            case 'ne':
                return state != killswitch.comperand;
                break;
            case 'lt':
                return state < killswitch.comperand;
                break;
            case 'le':
                return state <= killswitch.comperand;
                break;
            case 'gt':
                return state > killswitch.comperand;
                break;
            case 'ge':
                return state >= killswitch.comperand;
                break;
        }
    }

    private _getStateAsType(state: string | number | boolean, comperand: string | number | boolean): string | number | boolean {
        if (typeof comperand == 'string') return state as string;
        if (typeof comperand == 'number') return parseFloat(state as string);
        if (typeof comperand == 'boolean') return !!state;
    }
}
