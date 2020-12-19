"use strict";

var sunCalc = require('suncalc');
//var moment = require('moment');
var schedule = require('node-schedule');
var EventEmitter = require('events').EventEmitter;

const CATEGORY = 'Astro'
const SECONDS_IN_A_DAY = 24 * 60 * 60;

const logger = require('log4js').getLogger(CATEGORY);

var instance = null;

function wrapper(items, config) {
    if (instance == null) {
        instance = new Astro(items,config);
    }

    return instance;
}

class Astro extends EventEmitter
{
    constructor(items, config)
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
        this.lastEventSave = '';
        this.lastMoonPhaseSave = '';
        this.longitude = items[config.astro.zone].longitude;
        this.latitude = items[config.astro.zone].latitude;
        this.midnight = null;
        this.moon = null;
        logger.debug('Constructed')
    }
    
    run() {
        this.midnight = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._midnight());
        this.moon = schedule.scheduleJob({ minute: 15 }, () => this._updateMoon());
        this._midnight();
        this._updateMoon();
    }

    stop() {
        this.midnight.cancel();
        this.moon.cancel();
    }

    _setupTimes(times1, times2)
    {
        logger.debug('In setupTimes');
        var now = new Date();
        var latest = new Date(Number(now) - SECONDS_IN_A_DAY * 1000 * 2)
        var latestIndex = -1;

        for (var event of this.events)
        {
            this.times[event] = (Number(times1[event]) > Number(now))?
                times1[event] :
                times2[event];

            logger.debug(`Firing event ${event} at ${this.times[event].toString()}`);
            setTimeout((myEvent, that) =>
            {
                logger.debug(`Firing event ${myEvent}`);
                that.emit('astroevent', myEvent);
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

    _midnight() {
        var today = new Date();
        var tomorrow = new Date(Number(today) + SECONDS_IN_A_DAY * 1000);
        this._setupTimes(
            sunCalc.getTimes(today, this.latitude, this.longitude),
            sunCalc.getTimes(tomorrow, this.latitude, this.longitude));
    }

    _updateMoon()
    {
        this.lastMoonPhaseSave = this._moonPhase();
        this.emit("moonPhase", this.lastMoonPhaseSave);
    }

    _moonPhase()
    {
        let d1 = new Date();
        let d2 = new Date(Number(d1) + SECONDS_IN_A_DAY * 1000);
        d1.setHours(12, 0, 0, 0);
        d2.setHours(12, 0, 0, 0);
        var moon1 = sunCalc.getMoonIllumination(d1);
        var moon2 = sunCalc.getMoonIllumination(d2);
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
    
    get lastEvent()
    {
        return this.lastEventSave;
    }

    getEvent(eventName)
    {
        if (this.times.hasOwnProperty(eventName))
            return this.times[eventName].format();
        else
            return "0";
    }
    
    get lastMoonPhase()
    {
        return this.lastMoonPhaseSave;
    }

    isDark()
    {
        var temp = moment();
        var result;

        if (this.times[config.astro.daystart].isBefore(this.times[config.astro.dayend]))
        {
            result = (temp.isBetween(this.times[config.astro.daystart], this.times[config.astro.dayend]))? false : true;
        }
        else
        {
            result = (temp.isBetween(this.times[config.astro.dayend], this.times[config.astro.daystart]))? true : false;
        }

        return result;
    }

    isLight()
    {
        return this.isDark() == false;
    }
}

module.exports = wrapper;