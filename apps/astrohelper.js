"use strict"
const CATEGORY = 'AstroHelper';

const logger = require('log4js').getLogger(CATEGORY);

class AstroHelper {
    constructor(items, config) {
        this.lastEvent = items[config.astrohelper.lastevent];
        this.lastUpdate = items[config.astrohelper.lastupdate];
        this.dark = items[config.astrohelper.dark];
        this.moon = items[config.astrohelper.moon];
        this.astro = new (require('./astro'))(items,config);
        logger.debug('Constructed');
    }

    async run() {
        this.astro.on('astroevent', (event) => {
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
        this.lastEvent.updateState(this.astro.lastEvent);
        this.moon.updateState(this.astro.lastMoonPhase)
    }
    stop() {}
}

module.exports = AstroHelper;