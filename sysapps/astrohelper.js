"use strict"
var schedule = require('node-schedule');

const CATEGORY = 'AstroHelper';

const logger = require('log4js').getLogger(CATEGORY);

class AstroHelper {
    constructor(controller, config) {
        this.lastEvent = controller.items[config.astrohelper.lastevent];
        this.lastUpdate = controller.items[config.astrohelper.lastupdate];
        this.dark = controller.items[config.astrohelper.dark];
        this.moon = controller.items[config.astrohelper.moon];
        this.astro = new (require('./astro'))(controller, config);
        this.sunrise = controller.items[config.astrohelper.sunrise];
        this.sunset = controller.items[config.astrohelper.sunset];
        logger.debug('Constructed');
    }

    async run() {
        this.astro.on('astroevent', (event) => {
            let now = new Date();
            this.lastEvent.updateState(event);
            let nowString = now.getFullYear() + '-' +
                (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                now.getDate().toString().padStart(2, '0') + ' ' +
                now.getHours().toString().padStart(2, '0') + ':' +
                now.getMinutes().toString().padStart(2, '0') + ':' +
                now.getSeconds().toString().padStart(2, '0');
            this.lastUpdate.updateState(nowString);
        });
        this.astro.on('moonphase', (phase) => this.moon.updateState(phase));
        this.astro.on('isLight', () => this.dark.updateState(false));
        this.astro.on('isDark', () => this.dark.updateState(true))
        this.lastEvent.updateState(this.astro.lastEvent);
        let now = new Date();
        let nowString = now.getFullYear() + '-' +
            (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
            now.getDate().toString().padStart(2, '0') + ' ' +
            now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0') + ':' +
            now.getSeconds().toString().padStart(2, '0');
        this.lastUpdate.updateState(nowString);
        this.moon.updateState(this.astro.lastMoonPhase)
        this.dark.updateState(this.astro.isDark);
        this._setsuntimes();
        this.midnight = schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this._setsuntimes());
    }

    _setsuntimes() {
        if (this.sunrise) {
            let sr = this.astro.getEvent('sunrise');
            let srstr = 
                sr.getFullYear() + '-' +
                (sr.getMonth() + 1).toString().padStart(2, '0') + '-' +
                sr.getDate().toString().padStart(2, '0') + ' ' +
                sr.getHours().toString().padStart(2, '0') + ':' +
                sr.getMinutes().toString().padStart(2, '0') + ':' +
                sr.getSeconds().toString().padStart(2, '0');
            this.sunrise.updateState(srstr);
        }

        if (this.sunset) {
            let ss = this.astro.getEvent('sunset');
            let ssstr = 
                ss.getFullYear() + '-' +
                (ss.getMonth() + 1).toString().padStart(2, '0') + '-' +
                ss.getDate().toString().padStart(2, '0') + ' ' +
                ss.getHours().toString().padStart(2, '0') + ':' +
                ss.getMinutes().toString().padStart(2, '0') + ':' +
                ss.getSeconds().toString().padStart(2, '0');
            this.sunset.updateState(ssstr);
        }
    }

    stop() {
        this.midnight.cancel();
    }
}

module.exports = AstroHelper;