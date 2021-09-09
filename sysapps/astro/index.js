"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const suncalc_1 = require("suncalc");
const schedule = __importStar(require("node-schedule"));
const events_1 = require("events");
const log4js_1 = require("log4js");
const CATEGORY = 'Astro';
const SECONDS_IN_A_DAY = 24 * 60 * 60;
const logger = log4js_1.getLogger(CATEGORY);
class Astro extends events_1.EventEmitter {
    constructor(controller, _config) {
        super();
        this._times = {};
        this._events = [
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
        this._lastEventSave = null;
        this._lastMoonPhaseSave = '';
        this._midnightSched = null;
        this._moonSched = null;
        this._dayStart = null;
        this._dayEnd = null;
        this._longitude = controller.haConfig.longitude;
        this._latitude = controller.haConfig.latitude;
        this._midnight();
        this._updateMoon();
        logger.info('Constructed');
    }
    ;
    validate(config) {
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
        logger.info('Validated successful');
        return true;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this._midnightSched = schedule.scheduleJob({ hour: 0, minute: 0, second: 0 }, () => this._midnight());
            this._moonSched = schedule.scheduleJob({ minute: 15 }, () => this._updateMoon());
            return true;
        });
    }
    stop() {
        this._midnightSched.cancel();
        this._moonSched.cancel();
    }
    _setupTimes(times1, times2) {
        logger.debug('In setupTimes');
        let now = new Date();
        let latest = new Date(Number(now) - SECONDS_IN_A_DAY * 1000 * 2);
        let latestIndex = null;
        for (let event of this._events) {
            this._times[event] = (this._isAfter(times1[event], now))
                ? times1[event]
                : times2[event];
            logger.debug(`Firing event ${event} at ${this._times[event].toString()}`);
            setTimeout((myEvent, that) => {
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
            }, Number(this._times[event]) - Number(now), event, this);
            logger.trace(`astro - Compare ${this._times[event].toString()} to ${latest.toString()}`);
            if (Number(this._times[event]) > Number(latest)) {
                logger.trace('astro - Replacing previous time');
                latest = this._times[event];
                latestIndex = event;
            }
        }
        this._lastEventSave = latestIndex;
        logger.debug(`Last event was ${this._lastEventSave}`);
    }
    _midnight() {
        var today = new Date();
        var tomorrow = new Date(Number(today) + SECONDS_IN_A_DAY * 1000);
        this._setupTimes(suncalc_1.getTimes(today, this._latitude, this._longitude), suncalc_1.getTimes(tomorrow, this._latitude, this._longitude));
    }
    _updateMoon() {
        this._lastMoonPhaseSave = this._moonPhase();
        this.emit("moonPhase", this._lastMoonPhaseSave);
    }
    _moonPhase() {
        let d1 = new Date();
        let d2 = new Date(Number(d1) + SECONDS_IN_A_DAY * 1000);
        d1.setHours(12, 0, 0, 0);
        d2.setHours(12, 0, 0, 0);
        var moon1 = suncalc_1.getMoonIllumination(d1);
        var moon2 = suncalc_1.getMoonIllumination(d2);
        var phase = 'Not Set';
        logger.trace(`d1=${d1.toISOString()};d2=${d2.toISOString()};moon1.phase=${moon1.phase};moon2.phase=${moon2.phase}`);
        if (moon1.phase > moon2.phase) {
            phase = 'New Moon';
        }
        else if (moon1.phase < 0.25 && moon2.phase > 0.25) {
            phase = 'First Quarter';
        }
        else if (moon1.phase < 0.5 && moon2.phase > 0.5) {
            phase = 'Full Moon';
        }
        else if (moon1.phase < 0.75 && moon2.phase > 0.75) {
            phase = 'Last Quarter';
        }
        else if (moon1.phase < 0.25) {
            phase = 'Waxing Cresent';
        }
        else if (moon1.phase < 0.5) {
            phase = 'Waxing Gibbous';
        }
        else if (moon1.phase < 0.75) {
            phase = 'Waning Gibbous';
        }
        else if (moon1.phase < 1.0) {
            phase = 'Waning Cresent';
        }
        else {
            phase = 'Fuck Knows';
        }
        logger.debug(`astro - Moon Phase = ${phase}`);
        return phase;
    }
    get lastEvent() {
        return this._lastEventSave;
    }
    getEvent(eventName) {
        if (this._times.hasOwnProperty(eventName))
            return this._times[eventName];
        else
            return "0";
    }
    get lastMoonPhase() {
        return this._lastMoonPhaseSave;
    }
    get isDark() {
        var temp = new Date();
        var result;
        if (this._isBefore(this._times[this._dayStart], this._times[this._dayEnd])) {
            result = (this._isBetween(temp, this._times[this._dayStart], this._times[this._dayEnd])) ? false : true;
        }
        else {
            result = (this._isBetween(temp, this._times[this._dayEnd], this._times[this._dayStart])) ? true : false;
        }
        return result;
    }
    get isLight() {
        return this.isDark == false;
    }
    _isBetween(test, low, high) {
        return Number(test) > Number(low) && Number(test) < Number(high);
    }
    _isBefore(test, comparand) {
        return Number(test) < Number(comparand);
    }
    _isAfter(test, comparand) {
        return Number(test) > Number(comparand);
    }
}
module.exports = Astro;
//# sourceMappingURL=index.js.map