const EventEmitter = require('events');
var path = require('path');
const fs = require('fs');
var log4js = require('log4js');
var HaInterface = require('../hainterface');
var HaItemFactory = require('../haitems');

const CATEGORY = 'HaMain';
var logger = log4js.getLogger(CATEGORY);

const mod = 'HaMain';

class HaMain extends EventEmitter {
    constructor(config) {
        super();
        this.haInterface = null;
        this.items = {};
        this.apps = [];
        this.haItemFactory = null;
        this.config = config;
    }

    async start() {
        try {
            this.haInterface = new HaInterface(this.config.main.url, this.config.main.accessToken);
            this.haItemFactory = new HaItemFactory();
            await this.haInterface.start();
            let states = await this.haInterface.getStates();

            states.forEach((item) => {
                logger.trace(`Item name: ${item.entity_id}`);
                let itemInstance = this.haItemFactory.getItemObject(item, this.haInterface);
                this.items[itemInstance.name] = itemInstance;
            });

            this.haInterface.subscribe();
            this.haInterface.on('state_changed', (state) => {
                let name = state.entity_id.split('.')[1];
                if (state.new_state != null) {
                    logger.trace(`${name} New state: ${state.new_state.state}`);

                    if (name in this.items) {
                        this.items[name].setReceivedState(state.new_state);
                    }
                    else {
                        logger.warn(`Item ${name} not found`);
                    }
                }
                else {
                    logger.warn(`${name} received state update but new state was null`);
                }
            });

            this.haInterface.on('error', (err) => {
                logger.error(`Connection lost ${err} - retrying`);
                this.haInterface.kill();

                var retryTimer = setInterval(() => {
                    this.haInterface.start()
                        .then(() => {
                            logger.info('Reconnecton complete');
                            clearInterval(retryTimer);
                        })
                        .catch((err) => logger.error(`Reconnection failed: ${err} - retrying`));
                }, 5000);
            });

            logger.info(`Items loaded: ${Object.keys(this.items).length}`);

            let itemTypes = {};
            
            Object.keys(this.items).forEach((value, _index) => {
                if (this.items[value].__proto__.constructor.name in itemTypes) {
                    itemTypes[this.items[value].__proto__.constructor.name] += 1;
                }
                else {
                    itemTypes[this.items[value].__proto__.constructor.name] = 1;
                }
            });

            Object.keys(itemTypes).forEach((value, _index) => {
                logger.info(`${value}: ${itemTypes[value]}`);
            }); 

            this.apps = await this._getApps();
            logger.info(`Apps loaded: ${this.apps.length}`);

            // Construct all apps
            this.apps.forEach((app) => app.run());

        }
        catch (err) {
            logger.error(`Error: ${err}`);
            logger.info(`Stack:\n${err.stack}`);
            throw err;
        }
    }

    async stop() {
        try {
            await this.haInterface.stop();
        }
        catch (err) {
            logger.error(`Error: ${err}`);
            logger.info(`Stack:\n${err.stack}`);
            throw err;
        }
    }

    async _getApps() {
        let ret = new Promise(async (resolve, reject) => {
            try {
                let apps = [];
                const dir = await fs.promises.opendir(path.join(__dirname, '../apps'));

                for await (const dirent of dir) {
                    if (dirent.name.endsWith('.js')) {
                        let app = require(path.join('../apps', dirent.name));
                        apps.push(new app(this.items, this.config));
                    }
                }

                resolve(apps);
            }
            catch(err) {
                reject(err);
            }
        });

        return ret;
    }
}

module.exports = HaMain;
