"use strict";

import { getMoonIllumination, GetMoonIlluminationResult, getTimes, GetTimesResult } from 'suncalc';
import * as schedule from 'node-schedule';
import { HaMain } from '../../hamain';
import { getLogger } from 'log4js';
import { AppParent } from '../../common/appparent';

const CATEGORY: string = 'Astro'
const SECONDS_IN_A_DAY = 24 * 60 * 60;

const logger = getLogger(CATEGORY);

/* -------------------------------------------------------------------------- *\
    Config format:
    {
        astro: {
            "daystart": "sunrise",
            "dayend": "sunset"
        }
    }
    Values for daystart and dayend will determine the isDark timespan.
\* -------------------------------------------------------------------------- */
class Astro extends AppParent
{
    private _times: any = {};
    private static readonly _events: string[] = [
        "sunrise",
        "sunriseEnd",
        "goldenHourEnd",
        "solarNoon",
        "goldenHour",
        "sunsetStart",
        "sunset",
        "dusk",
        "nauticalDusk",
        "night",
        "nadir",
        "nightEnd",
        "nauticalDawn",
        "dawn"
    ];;
    private _lastEventSave: string = null;
    private _lastMoonPhaseSave: string = '';
    private _longitude: number;
    private _latitude: number;
    private _midnightSched: schedule.Job = null;
    private _moonSched: schedule.Job = null;
    private _dayStart: string = null;
    private _dayEnd: string = null;
    public constructor(controller: HaMain, _config: any) {
        super(logger);
        this._longitude = controller.haConfig.longitude;
        this._latitude = controller.haConfig.latitude;
        logger.info('Constructed')
    }

    public validate(config: any): boolean {
        if (config.logLevel) {
            try {
                this.logging = config.logLevel;
                logger.info(`Set log level to ${config.logLevel}`);
            }
            catch (err: any) {
                logger.error(`Failed to set log level to ${config.logLevel}`);
            }
        }

        if (!this._longitude || !this._latitude) {
            logger.error('Unable to determine location from Home Assistant - ensure the longitude and latitude are set');
            return false;
        }

        if (!config.daystart) {
            logger.error('daystart missing from config');
            return false;
        }

        if (!config.dayend) {
            logger.error('dayend missing from config');
            return false;
        }

        this._dayStart = config.daystart;
        this._dayEnd = config.dayend;
        logger.info('Validated successful')

        return true;
    }
    
    public async run(): Promise<boolean> {
        this._midnight(this);
        this._updateMoon();
        this._midnightSched = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._midnight(this));
        this._moonSched = schedule.scheduleJob({ minute: 15 }, () => this._updateMoon());
        this.emit('initialized');

        return true;
    }

    public async stop(): Promise<void> {
        this._midnightSched.cancel();
        this._moonSched.cancel();
    }

    private _setupTimes(times1: GetTimesResult, times2: GetTimesResult, that: Astro): void
    {
        logger.debug('In setupTimes');
        let now: Date = new Date();
        let latest: Date = new Date(Number(now) - SECONDS_IN_A_DAY * 1000 * 2)
        let latestIndex: string = null;

        for (let event of Astro._events)
        {
            that._times[event] = (that._isAfter((times1 as any)[event], now))
                ? (times1 as any)[event]
                : (times2 as any)[event];

            logger.debug(`Firing event ${event} at ${that._times[event].toString()}`);
            setTimeout((myEvent, that) =>
            {
                logger.debug(`Firing event ${myEvent}`);
                that.emit('astroevent', myEvent);
                if (myEvent == that._dayStart) {
                    logger.debug('Firing event isLight');
                    that.emit('isLight');
                }
                else if (myEvent == that._dayEnd) {
                    logger.debug('Firing event isDark');
                    that.emit('isDark');
                }
            }, Number(that._times[event]) -  Number(now), event, that);
            
            logger.trace(`Compare ${that._times[event].toString()} to ${latest.toString()}`);
            if (Number(that._times[event]) > Number(latest))
            {
                logger.trace('Replacing previous time');
                latest = that._times[event];
                latestIndex = event;
            }
        }
        
        that._lastEventSave = latestIndex;
        logger.debug(`Last event was ${that._lastEventSave}`);
    }

    private _midnight(that: Astro): void {
        var today: Date = new Date();
        var tomorrow: Date = new Date(Number(today) + SECONDS_IN_A_DAY * 1000);
        this._setupTimes(
            getTimes(today, this._latitude, this._longitude),
            getTimes(tomorrow, this._latitude, this._longitude),
            that);
    }

    private _updateMoon(): void
    {
        this._lastMoonPhaseSave = this._moonPhase();
        this.emit("moonPhase", this._lastMoonPhaseSave);
    }

    private _moonPhase(): string
    {
        let d1 = new Date();
        let d2 = new Date(Number(d1) + SECONDS_IN_A_DAY * 1000);
        d1.setHours(12, 0, 0, 0);
        d2.setHours(12, 0, 0, 0);
        var moon1: GetMoonIlluminationResult = getMoonIllumination(d1);
        var moon2: GetMoonIlluminationResult = getMoonIllumination(d2);
        var phase = 'Not Set';

        logger.trace(`d1=${d1.toISOString()};d2=${d2.toISOString()};moon1.phase=${moon1.phase};moon2.phase=${moon2.phase}`);

        if (moon1.phase > moon2.phase)
        {
            phase = 'New Moon';
        }
        else if (moon1.phase < 0.25 && moon2.phase > 0.25)
        {
            phase = 'First Quarter';
        }
        else if (moon1.phase < 0.5 && moon2.phase > 0.5)
        {
            phase = 'Full Moon';
        }
        else if (moon1.phase < 0.75 && moon2.phase > 0.75)
        {
            phase = 'Last Quarter';
        }
        else if (moon1.phase < 0.25)
        {
            phase = 'Waxing Cresent'
        }
        else if (moon1.phase < 0.5)
        {
            phase = 'Waxing Gibbous'
        }
        else if (moon1.phase < 0.75)
        {
            phase = 'Waning Gibbous'
        }
        else if (moon1.phase < 1.0)
        {
            phase = 'Waning Cresent'
        }
        else
        {
            phase = 'Fuck Knows'
        }

        logger.debug(`Moon Phase = ${phase}`);
        return phase;
    }
    
    public get lastEvent(): string
    {
        return this._lastEventSave;
    }

    public getEvent(eventName: string): string
    {
        if (this._times.hasOwnProperty(eventName))
            return this._times[eventName];
        else
            return "0";
    }
    
    public get lastMoonPhase(): string
    {
        return this._lastMoonPhaseSave;
    }

    public get isDark(): boolean {
        var temp = new Date();
        var result;

        if (this._isBefore(this._times[this._dayStart], this._times[this._dayEnd])) {
            result = (this._isBetween(temp, this._times[this._dayStart], this._times[this._dayEnd]))? false : true;
        } else {
            result = (this._isBetween(temp, this._times[this._dayEnd], this._times[this._dayStart]))? true : false;
        }

        return result;
    }

    public get isLight(): boolean {
        return this.isDark == false;
    }

    private _isBetween(test: Date, low: Date, high: Date): boolean {
        return Number(test) > Number(low) && Number(test) < Number(high);
    }

    private _isBefore(test: Date, comparand: Date): boolean {
        return Number(test) < Number(comparand);
    }

    private _isAfter(test: Date, comparand: Date): boolean {
        return Number(test) > Number(comparand);
    }
}

module.exports = Astro;