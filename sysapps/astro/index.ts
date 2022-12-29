"use strict";

var SolarCalc = require('solar-calc');
import * as Lune from 'lune';
import * as schedule from 'node-schedule';
import { HaMain } from '../../hamain';
import { getLogger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { stringValidator } from '../../common/validator';

const CATEGORY: string = 'Astro'
const SECONDS_IN_A_DAY = 24 * 60 * 60;

const logger = getLogger(CATEGORY);

/* -------------------------------------------------------------------------- *\
    Config format:
    astro:
        daystart: 'sunrise'
        dayend: 'sunset'
        logLevel: 'debug'
    Values for daystart and dayend will determine the isDark timespan.
\* -------------------------------------------------------------------------- */

export interface AstroEvents {
    'astroEvent': (event: string) => void;
    'moonPhase': (phase: string) => void;
    'isLight': () => void;
    'isDark': () => void;
}

export declare interface Astro {
    on<U extends keyof AstroEvents>(event: U, listner: AstroEvents[U]): this;
    emit<U extends keyof AstroEvents>(event: U, ...args: Parameters<AstroEvents[U]>): boolean;
}

type EventTime = {
    eventName: string;
    eventTime: Date | 'error';
}

enum EventNames {
    NIGHTEND,
    NAUTICALDAWN,
    DAWN,
    SUNRISE,
    SUNRISEEND,
    GOLDENHOUREND,
    SOLARNOON,
    GOLDENHOURSTART,
    SUNSETSTART,
    SUNSET,
    DUSK,
    NAUTICALDUSK,
    NIGHTSTART,
    NADIR,
}

export class Astro extends AppParent
{
    // private _times: any = {};
    private _events: EventTime[] = [
        { eventName: "nightEnd", eventTime: null },
        { eventName: "nauticalDawn", eventTime: null },
        { eventName: "dawn", eventTime: null },
        { eventName: "sunrise",  eventTime: null },
        { eventName: "sunriseEnd",  eventTime: null },
        { eventName: "goldenHourEnd", eventTime: null },
        { eventName: "solarNoon",  eventTime: null },
        { eventName: "goldenHourStart", eventTime: null },
        { eventName: "sunsetStart",  eventTime: null },
        { eventName: "sunset",  eventTime: null },
        { eventName: "dusk", eventTime: null },
        { eventName: "nauticalDusk", eventTime: null },
        { eventName: "nightStart", eventTime: null },
        { eventName: "nadir", eventTime: null },
    ];
    private _lastEventSave: string = null;
    private _lastMoonPhaseSave: string = '';
    private _longitude: number;
    private _latitude: number;
    private _midnightSched: schedule.Job = null;
    private _moonSched: schedule.Job = null;
    private _nextEvent: schedule.Job = null;
    private _dayStart: number = null;
    private _dayEnd: number = null;
    private _getEvents: () => void = (): void => {
        const fireEvent = () => {
            logger.debug(`Firing event ${this._events[nextEvent].eventName}`);
            this.emit('astroEvent', this._events[nextEvent].eventName);
            this._lastEventSave = this._events[nextEvent].eventName;

            if (++nextEvent < this._events.length) {
                logger.debug(`Scheduling ${this._events[nextEvent].eventName} at ${this._events[nextEvent].eventTime}`);
                this._nextEvent = schedule.scheduleJob(this._events[nextEvent].eventTime, fireEvent);
            }
            else {
                logger.debug(`All events fired - refreshing`);
                this._midnightSched = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._getEvents());
            }
        }
        var today: Date = new Date();
        var solar = new SolarCalc(today, this._latitude, this._longitude);
        var otherSolar = new SolarCalc(today, this._latitude * -1, this._longitude < 0? this._longitude + 180 : this._longitude - 180);
        this._events[EventNames.NIGHTEND].eventTime = solar.nightEnd;
        this._events[EventNames.NAUTICALDAWN].eventTime = solar.nauticalDawn;
        this._events[EventNames.DAWN].eventTime = solar.dawn;
        this._events[EventNames.SUNRISE].eventTime = solar.sunrise;
        this._events[EventNames.SUNRISEEND].eventTime = solar.sunriseEnd;
        this._events[EventNames.GOLDENHOUREND].eventTime = solar.goldenHourEnd;
        this._events[EventNames.SOLARNOON].eventTime = solar.solarNoon;
        this._events[EventNames.GOLDENHOURSTART].eventTime = solar.goldenHourStart;
        this._events[EventNames.SUNSETSTART].eventTime = solar.sunsetStart;
        this._events[EventNames.SUNSET].eventTime = solar.sunset;
        this._events[EventNames.DUSK].eventTime = solar.dusk;
        this._events[EventNames.NAUTICALDUSK].eventTime = solar.nauticalDusk;
        this._events[EventNames.NIGHTSTART].eventTime = solar.nightStart;
        this._events[EventNames.NADIR].eventTime = otherSolar.solarNoon;

        this._events.forEach((event) => logger.debug(`Firing event ${event.eventName} at ${(event.eventTime as Date)}`));

        let now: Date = new Date();
        let nextEvent = -1;
        // let lastEvent: number = this._events.findIndex((event: EventTime, index: number, events: EventTime[]) => {
        //     if (Number(now) > Number(event.eventTime) && index + 1 < events.length && Number(now) < Number(events[index + 1].eventTime)) {
        //         return true;
        //     }
        // });

        let i: number;

        for (i = 0; i < this._events.length; i++) {
            if (Number(now) < Number(this._events[i].eventTime)) break;
        }

        nextEvent = i < this._events.length? i : -1;
        this._lastEventSave = nextEvent < 1? this._events[EventNames.NADIR].eventName : this._events[nextEvent - 1].eventName;

        if (nextEvent == -1) {
            logger.debug('Scheduling event refresh')
            this._midnightSched = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._getEvents());
        }
        else {
            logger.debug(`Scheduling ${this._events[nextEvent].eventName} at ${(this._events[nextEvent].eventTime as Date)}`);
            this._nextEvent = schedule.scheduleJob(this._events[nextEvent].eventTime, fireEvent);
        }
    }

    public constructor(controller: HaMain) {
        super(controller, logger);
        logger.info('Constructed')
    }

    public validate(config: any): boolean {
        try {
            if (config.logLevel) {
                try {
                    this.logging = config.logLevel;
                    logger.info(`Set log level to ${config.logLevel}`);
                }
                catch (err: any) {
                    logger.error(`Failed to set log level to ${config.logLevel}`);
                }
            }

            this._longitude = this.controller.haConfig.longitude;
            this._latitude = this.controller.haConfig.latitude;

            if (!this._longitude || !this._latitude) {
                throw new Error('Unable to determine location from Home Assistant - ensure the longitude and latitude are set');
            }

            stringValidator.isValid(config.daystart, { name: 'daystart'});
            stringValidator.isValid(config.dayend, { name: 'dayend'});

            if (-1 == (this._dayStart = this._events.findIndex((event) => config.daystart == event.eventName))) {
                throw new Error(`Value ${config.daystart} is not a valid event`);
            }
            
            if (-1 == (this._dayEnd = this._events.findIndex((event) => config.dayend == event.eventName))) {
                throw new Error(`Value ${config.dayend} is not a valid event`);
            }

            if (this._dayStart >= this._dayEnd) {
                throw new Error(`Day start event must come before day end event`);
            }
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }
        logger.info('Validated successful')

        return true;
    }
    
    public async run(): Promise<boolean> {
        this._getEvents();
        this._updateMoon();
        // this._midnightSched = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._midnight());
        this._moonSched = schedule.scheduleJob({ minute: 15 }, () => this._updateMoon());

        return true;
    }

    public async stop(): Promise<void> {
        if (this._midnightSched) this._midnightSched.cancel();
        this._moonSched.cancel();
        this._nextEvent.cancel();
    }

    private _updateMoon(): void
    {
        let moonPhase = this._moonPhase();

        if (moonPhase != this._lastMoonPhaseSave) {
            this._lastMoonPhaseSave = moonPhase;
            this.emit("moonPhase", this._lastMoonPhaseSave);
        }
    }

    private _moonPhase(): string
    {
        const phaseNames: string[] = [ 'Full Moon', 'New Moon', 'New Moon', 'First Quarter', 'Last Quarter' ];
        let today = new Date();
        let yesterday = new Date(Number(today) - SECONDS_IN_A_DAY * 1000);
        yesterday.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        let yesterdayMoon = Lune.phase(yesterday);
        let todayMoon = Lune.phase(today);
        let phases = Lune.phase_hunt(today);
        let phaseList: Date[] = [ phases.full_date, phases.new_date, phases.nextnew_date, phases.q1_date, phases.q3_date ];
        var phase = 'Not Set';

        logger.trace(`yesterday=${yesterday.toISOString()};today=${today.toISOString()};yesterdayMoon.phase=${yesterdayMoon.phase};todayMoon.phase=${todayMoon.phase}`);

        let index = (phaseList.findIndex((eventDate) => today.getTime() == eventDate.setHours(0, 0, 0, 0)));

        if (index != -1) {
            phase = phaseNames[index];
        }
        else {
            if (yesterdayMoon.phase < 0.25)
            {
                phase = 'Waxing Cresent'
            }
            else if (yesterdayMoon.phase < 0.5)
            {
                phase = 'Waxing Gibbous'
            }
            else if (yesterdayMoon.phase < 0.75)
            {
                phase = 'Waning Gibbous'
            }
            else if (yesterdayMoon.phase < 1.0)
            {
                phase = 'Waning Cresent'
            }
            else
            {
                phase = 'Fuck Knows'
            }
        }

        logger.debug(`Moon Phase = ${phase}`);
        return phase;
    }
    
    public get lastEvent(): string
    {
        return this._lastEventSave;
    }

    public getEvent(eventName: string): Date | 'error'
    {
        let e = this._events.find((event) => event.eventName == eventName)

        if (e) return e.eventTime;
        else return 'error';
    }
    
    public get lastMoonPhase(): string
    {
        return this._lastMoonPhaseSave;
    }

    public get isDark(): boolean {
        return !this.isLight;
    }

    public get isLight(): boolean {
        return this._isBetween(new Date(), this._events[this._dayStart].eventTime, this._events[this._dayEnd].eventTime);
    }

    private _isBetween(test: Date, low: Date | 'error', high: Date | 'error'): boolean {
        if (low == 'error' || high == 'error') {
            throw new Error('Dates are broken - this is probably a bug');
        }
        return Number(test) > Number(low) && Number(test) < Number(high);
    }
}

export default Astro;
