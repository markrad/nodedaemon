"use strict";
// TODO Minimum conversion

import { getMoonIllumination, GetMoonIlluminationResult, getTimes, GetTimesResult } from 'suncalc';
var schedule = require('node-schedule');
import { HaMain } from '../../hamain';
import { EventEmitter } from 'events';
import { getLogger } from 'log4js';
import { IApplication } from '../../common/IApplication';

const CATEGORY: string = 'Astro'
const SECONDS_IN_A_DAY = 24 * 60 * 60;

const logger = getLogger(CATEGORY);
class Astro extends EventEmitter implements IApplication
{
    times: any;
    events: string[];
    lastEventSave: number;
    lastMoonPhaseSave: string;
    longitude: number;
    latitude: number;
    midnight: any;
    moon: any;
    //config: any;
    private _dayStart: string;
    private _dayEnd: string;
constructor(controller: HaMain, config: any)
    {
        super();
        this.times = {};
        this.events = [
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
        ];
        this.lastEventSave = null;
        this.lastMoonPhaseSave = '';
        this.longitude = controller.haConfig.longitude;
        this.latitude = controller.haConfig.latitude;
        this.midnight = null;
        this.moon = null;
        //this.config = config.astro;
        this._dayStart = null;
        this._dayEnd = null;
        this._midnight();
        this._updateMoon();
        logger.info('Constructed')
    }

    validate(config: any): boolean {
        if (!this.longitude || !this.latitude) {
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

        return true;
    }
    
    async run(): Promise<boolean> {
        this.midnight = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._midnight());
        this.moon = schedule.scheduleJob({ minute: 15 }, () => this._updateMoon());

        return true;
    }

    stop() {
        this.midnight.cancel();
        this.moon.cancel();
    }

    _setupTimes(times1: GetTimesResult, times2: GetTimesResult)
    {
        logger.debug('In setupTimes');
        var now = new Date();
        var latest = new Date(Number(now) - SECONDS_IN_A_DAY * 1000 * 2)
        var latestIndex: any = -1;

        for (var event of this.events)
        {
            this.times[event] = (this._isAfter((times1 as any)[event], now))
                ? (times1 as any)[event]
                : (times2 as any)[event];

            logger.debug(`Firing event ${event} at ${this.times[event].toString()}`);
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
            }, Number(this.times[event]) -  Number(now), event, this);
            
            logger.trace(`astro - Compare ${this.times[event].toString()} to ${latest.toString()}`);
            if (Number(this.times[event]) > Number(latest))
            {
                logger.trace('astro - Replacing previous time');
                latest = this.times[event];
                latestIndex = event;
            }
        }
        
        this.lastEventSave = latestIndex;
        logger.debug(`Last event was ${this.lastEventSave}`);
    }

    _midnight(): void {
        var today: Date = new Date();
        var tomorrow: Date = new Date(Number(today) + SECONDS_IN_A_DAY * 1000);
        this._setupTimes(
            getTimes(today, this.latitude, this.longitude),
            getTimes(tomorrow, this.latitude, this.longitude));
    }

    _updateMoon(): void
    {
        this.lastMoonPhaseSave = this._moonPhase();
        this.emit("moonPhase", this.lastMoonPhaseSave);
    }

    _moonPhase(): string
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

        logger.debug(`astro - Moon Phase = ${phase}`);
        return phase;
    }
    
    get lastEvent(): number
    {
        return this.lastEventSave;
    }

    getEvent(eventName: string): string
    {
        if (this.times.hasOwnProperty(eventName))
            return this.times[eventName];
        else
            return "0";
    }
    
    get lastMoonPhase(): string
    {
        return this.lastMoonPhaseSave;
    }

    get isDark(): boolean {
        var temp = new Date();
        var result;

        if (this._isBefore(this.times[this._dayStart], this.times[this._dayEnd])) {
            result = (this._isBetween(temp, this.times[this._dayStart], this.times[this._dayEnd]))? false : true;
        } else {
            result = (this._isBetween(temp, this.times[this._dayEnd], this.times[this._dayStart]))? true : false;
        }

        return result;
    }

    get isLight(): boolean {
        return this.isDark == false;
    }

    _isBetween(test: Date, low: Date, high: Date): boolean {
        return Number(test) > Number(low) && Number(test) < Number(high);
    }

    _isBefore(test: Date, comparand: Date): boolean {
        return Number(test) < Number(comparand);
    }

    _isAfter(test: Date, comparand: Date): boolean {
        return Number(test) > Number(comparand);
    }
}

module.exports = Astro;