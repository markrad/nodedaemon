"use strict";

import { IHaItem } from "../../haitems/ihaitem";
import { IHaItemSwitch } from "../../haitems/ihaitemswitch";
import { HaMain } from "../../hamain";
import { State } from '../../hamain/state';
import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { entityValidator, numberValidator } from "../../common/validator";
import { HaGenericSwitchItem } from "../../haitems/hagenericswitchitem";
import { HaParentItem } from "../../haitems/haparentitem";
import { HaGenericBinaryItem } from "../../haitems/hagenericbinaryitem";

interface IKillSwitch {
    entity: IHaItem;
    op: string;
    comperand: string | number | boolean;
}
interface ITrip {
    sensor: IHaItem[];
    lights: IHaItemSwitch[];
    timeout: number;
    killSwitch?: IKillSwitch;
}

const CATEGORY = 'MotionLight';
var logger: Logger = getLogger(CATEGORY);

export default class MotionLight extends AppParent {
    private _actioners: actioner[] = [];
    private _trips: ITrip[] = null;
    constructor(controller: HaMain) {
        super(controller, logger);
        logger.info('Constructed');
    }

    public async validate(config: any): Promise<boolean> {
        const ops: string[] = ['eq', 'ne', 'lt', 'le', 'gt', 'ge'];
        if (! await super.validate(config)) {
            return false;
        }
        if (!config || !config.entries) {
            logger.error('No devices specified');
        }
        else {
            if (!Array.isArray(config.entries)) {
                logger.error('Invalid device specification');
                return false;
            }
            this._trips = config.entries.map((value: any) => {
                try {
                    // let sensor: HaGenericBinaryItem[];
                    let delay: number;
                    let op: string = null;
                    let comp: string | number | boolean;
                    let killEntity: HaParentItem = null;
                    if (!Array.isArray(value.sensor)) value.sensor = [ value.sensor ];
                    let sensor: HaGenericBinaryItem[] = (value.sensor as Array<string>).map((value: string) => {
                        let tempsen: HaGenericBinaryItem;
                        tempsen = entityValidator.isValid(value, { name: 'sensor', entityType: HaGenericBinaryItem});
                        return tempsen;
                    })
                    // if (!(sensor = entityValidator.isValid(value.sensor, { entityType: HaGenericBinaryItem }))) throw new Error('Entry does not contain a sensor');
                    if (value.switch == undefined) throw new Error('Entry does not contain any switches');
                    delay = numberValidator.isValid(value.delay, { name: 'delay', minValue: 0, floatOk: true });
                    if (!Array.isArray(value.switch)) value.switch = [ value.switch ];

                    if (value.killSwitch) {
                        if (!ops.includes(value.killSwitch.operator)) throw new Error(`Invalid operator ${value.killSwitch.op} passed`);
                        op = value.killSwitch.operator;
                        if (!value.killSwitch.comperand) throw new Error('killSwitch is missing comperand');
                        comp = value.killSwitch.comperand;
                        // if (!('comperand' in value.killSwitch)) throw new Error('killSwitch is missing comperand');
                        killEntity = entityValidator.isValid(value.killSwitch.killEntity, { name: 'killEntity', entityType: HaParentItem });

                    }
                    let lights: HaGenericSwitchItem[] = (value.switch as Array<string>).map((value: string) => {
                        let tempsw: HaGenericSwitchItem;
                        if (!(tempsw = entityValidator.isValid(value, { entityType: HaGenericSwitchItem }))) throw new Error(`Specified target light is not a switch or a light: ${value}`);
                        return tempsw;
                    })
                    let trip: ITrip = {
                        sensor: sensor,
                        lights: lights,
                        timeout: delay
                    }
                    if (killEntity) {
                        trip.killSwitch = {
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
            }).filter((item: ITrip) => item != null);

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
    private _trip: ITrip;
    private _timer: NodeJS.Timer = null;
    private _eventHandler: (that: IHaItem, oldState: State) => void;
    public constructor(trip: ITrip) {
        this._trip = trip;
        this._timer = null;

        this._eventHandler = (that: IHaItem, _oldState: State) => {
            logger.debug(`State ${that.state} triggered on ${that.entityId} for ${this._trip.lights.map(item => item.entityId).join(' ')}`);
            if (that.state == 'on' && !this.shouldIgnore(this._trip.killSwitch)) {
                this._trip.lights.forEach((light: IHaItemSwitch) => {
                    light.turnOffAt(Date.now() + this._trip.timeout * 60 * 1000);
                });
                this._timer = setInterval(() => 
                { 
                    if (!this._trip.lights[0].isTimerRunning) {
                        clearInterval(this._timer);
                        this._timer = null;
                    }
                    else if (this._trip.sensor.find((sensor) => sensor.state == 'on')) {
                    // else if (this._trip.sensor.state == 'on') {
                        // logger.trace(`Checking motion sensor status: ${this._trip.sensor.state}`);
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
        this._trip.sensor.forEach((sensor) => sensor.on('new_state', this._eventHandler));
        // this._trip.sensor.on('new_state', this._eventHandler); 
    }

    public async stop(): Promise<void> {
        this._trip.sensor.forEach((sensor) => sensor.off('new_state', this._eventHandler));
        // this._trip.sensor.off('new_state', this._eventHandler);
    }

    private shouldIgnore(killSwitch: IKillSwitch): boolean {
        if (!killSwitch) {
            return false;
        }

        let ret: boolean;

        let state: string | number | boolean | Date = this._getStateAsType(killSwitch.entity.state, killSwitch.comperand);

        logger.debug(`Comparing comperand ${+killSwitch.comperand} (${typeof killSwitch.comperand}) operator ${killSwitch.op} state ${+state} (${typeof state})`);

        switch (killSwitch.op) {
            case 'eq':
                ret = +state == +killSwitch.comperand;
                break;
            case 'ne':
                ret =  state != killSwitch.comperand;
                break;
            case 'lt':
                ret =  state < killSwitch.comperand;
                break;
            case 'le':
                ret =  state <= killSwitch.comperand;
                break;
            case 'gt':
                ret =  state > killSwitch.comperand;
                break;
            case 'ge':
                ret =  state >= killSwitch.comperand;
                break;
            default:
                break;
        }

        logger.debug(`${ret? 'Action killed' : 'Action proceeds'}`);
        return ret;
    }

    private _getStateAsType(state: string | number | boolean | Date, comperand: string | number | boolean | Date): string | number | boolean | Date {
        if (typeof comperand == 'string') return state as string;
        if (typeof comperand == 'number') return parseFloat(state as string);
        if (typeof comperand == 'boolean') return !!state;
        if (comperand instanceof Date) return new Date(state as string);
    }
}
