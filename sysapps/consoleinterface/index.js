"use strict";

var log4js = require('log4js');

const CATEGORY = 'ConsoleInterface';
var logger = log4js.getLogger(CATEGORY);

class ConsoleInterface {
    constructor(controller) {
        this._config;
        this._controller = controller;
        this._items = controller.items;
        this._transports = [];
    }

    validate(config) {
        this._config = config;
        logger.info('Constructed');
        return true;
    }

    get items() {
        return this._items;
    }

    get controller() {
        return this._controller;
    }

    async run() {
        let name = this.controller.haConfig.location_name;
        let cmds = [
            new (require('./commandhelp'))(),
            new (require('./commandgetconfig'))(),
            new (require('./commanduptime'))(),
            new (require('./commandinspect'))(),
            new (require('./commandstop'))(),
            new (require('./commandlist'))(),
            new (require('./commandapp'))(),
            new (require('./commandha'))(),
        ];

        if (this._config?.transports) {
            try {
                this._config.transports.forEach(transport => {
                    try {
                        this._transports.push(new (require(transport))(name, this, cmds, this._config));
                    }
                    catch (err) {
                        logger.error(`Failed to create transport ${transport}: ${err}`);
                    }
                });
            }
            catch (err) {
                logger.error(`Failed to interate transports ${err}`);
            }
        }
        else {
            logger.warn('No transports specified');
        }

        this._transports.forEach(async (transport) => await transport.start());
    }

    async stop() {
        return new Promise((resolve, reject) => {
            let rets = [];
            this._transports.forEach(async (transport) => rets.push(transport.stop()));
            Promise.all(rets)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    }
}

module.exports = ConsoleInterface;