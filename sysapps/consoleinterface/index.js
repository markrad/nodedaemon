var log4js = require('log4js');

const CATEGORY = 'ConsoleInterface';
var logger = log4js.getLogger(CATEGORY);

class ConsoleInterface {
    constructor(controller, config) {
        this._config = config.consoleInterface || {};
        this._controller = controller;
        this._items = controller.items;
        this._transports = [];
        logger.debug('Construction complete');
    }

    async run() {
        let that = this;
        let name = this._controller.haConfig.location_name;
        let cmds = [
            new (require('./commandhelp'))(),
            new (require('./commandgetconfig'))(),
            new (require('./commanduptime'))(),
            new (require('./commandinspect'))(),
            new (require('./commandstop'))(),
            new (require('./commandlist'))(),
            new (require('./commandapp'))(),
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