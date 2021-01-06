const EventEmitter = require('events');
var path = require('path');
const fs = require('fs');
var log4js = require('log4js');
var HaInterface = require('../hainterface');
var HaItemFactory = require('../haitems');
const { description } = require('commander');

const CATEGORY = 'HaMain';
var logger = log4js.getLogger(CATEGORY);

if (process.env.HAMAIN_LOGGING) {
    logger.level = process.env.HAMAIN_LOGGING;
}

class HaMain extends EventEmitter {
    constructor(config) {
        super();
        this.haInterface = null;
        this._items = {};
        this._apps = [];
        this.haItemFactory = null;
        this.config = config;
        this.stopping = false;
        this._haConfig = null;
    }

    async start() {
        try {
            this.haInterface = new HaInterface(this.config.main.url, this.config.main.accessToken);
            this.haItemFactory = new HaItemFactory();
            await this.haInterface.start();
            this._haConfig = await this.haInterface.getConfig();
            let states = await this.haInterface.getStates();

            states.forEach((item) => {
                logger.trace(`Item name: ${item.entity_id}`);
                let itemInstance = this.haItemFactory.getItemObject(item, this.haInterface);
                itemInstance.on('callservice', async (domain, service, data) => {
                    try {
                        await this.haInterface.callService(domain, service, data)
                    }
                    catch (err) {
                        // Error already logged
                    }
                });

                if (itemInstance in this._items) {
                    logger.fatal('fuck');
                }
                else {
                    this._items[itemInstance.name] = itemInstance;
                }
            });

            this.haInterface.subscribe();
            this.haInterface.on('state_changed', async (state) => {
                let name = state.entity_id.split('.')[1];

                if (name in this._items) {
                    if (state.new_state != null) {
                        logger.trace(`${name} New state: ${state.new_state.state}`);
                        this._items[name].setReceivedState(state.new_state);
                    }
                    else {
                        logger.info(`Item ${name} has been dropped`);
                        delete this._items[name];
                    }
                }
                else {
                    logger.warn(`Item ${name} not found - refreshing devices`);
                    let states = await this.haInterface.getStates();
                    states.forEach((item) => {
                        if (!(item.entity_id.split('.')[1] in this._items)) {
                            let itemInstance = this.haItemFactory.getItemObject(item, this.haInterface);
                            this._items[itemInstance.name] = itemInstance;
                            logger.info(`Added new item ${itemInstance.name}`);
                        }
                    });
                }
            });

            this.haInterface.on('reconnected', () => {
                this.haInterface.subscribe();
            });

            this.haInterface.on('fatal_error', (err) => {
                logger.fatal(`Transport layer reports fatal error - ${err.message}`);
                process.exit(4);
            });

            logger.info(`Items loaded: ${Object.keys(this._items).length}`);

            let itemTypes = {};
            
            Object.keys(this._items).forEach((value, _index) => {
                if (this._items[value].__proto__.constructor.name in itemTypes) {
                    itemTypes[this._items[value].__proto__.constructor.name] += 1;
                }
                else {
                    itemTypes[this._items[value].__proto__.constructor.name] = 1;
                }
            });

            Object.keys(itemTypes).forEach((value, _index) => {
                logger.info(`${value}: ${itemTypes[value]}`);
            }); 

            this._apps = await this._getApps(this.config.main.appsDir);
            logger.info(`Apps loaded: ${this._apps.length}`);

            // Construct all apps
            this._apps.forEach((app) => {
                try {
                    app.instance.run();
                    app.status = 'running';
                }
                catch (err) {
                    app.status = 'failed';
                    logger.warn(`Could not run app ${app.__proto__.constructor.name} - ${err}`);
                }
            });

        }
        catch (err) {
            logger.error(`Error: ${err}`);
            logger.info(`Stack:\n${err.stack}`);
            throw err;
        }
    }

    async stop() {
        return new Promise(async (resolve, reject) => {
            this.stopping = true;

            this._apps.forEach(async (app) => {
                try {
                    await app.instance.stop();
                    app.status = 'stopped';
                }
                catch (err) {
                    logger.warn(`Failed to stop app ${app}: ${err.message}`);
                    app.status = 'failed';
                }
            });
            try {
                if (this.haInterface.isConnected) {
                    await this.haInterface.stop();
                }
                resolve();
            }
            catch (err) {
                logger.error(`Error: ${err}`);
                logger.info(`Stack:\n${err.stack}`);
                reject(err);
            }
            });
    }

    get items() {
        return this._items
    }

    get apps() {
        return this._apps;
    }

    get haConfig() {
        return this._haConfig;
    }

    async _reconnect(err) {
        return new Promise(async (resolve, reject) => {
            if (this.stopping || err) {
                let connected = false;

                while (!connected) {

                    try {
                        await this.haInterface.start();
                        logger.info('Reconnecton complete');
                        connected = true;
                    }
                    catch (err) {
                        logger.error(`Reconnection failed: ${err} - retrying`);
                    }
                    
                    await this._wait(5);
                }
            }
        });
    }

    async _wait(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }
    
    async _getApps(appsDirectory) {
        let ret = new Promise(async (resolve, reject) => {
            try {
                let apps = [];
                const dir = await fs.promises.opendir(appsDirectory);
                let appobject;

                for await (const dirent of dir) {
                    if (dirent.name.endsWith('.js')) {
                        let app = require(path.join(dir.path, dirent.name));
                        try {
                            appobject = new app(this, this.config);
                            apps.push({ name: appobject.__proto__.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'constructed' });
                        }
                        catch (err) {
                            apps.push({ name: appobject.__proto__.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'failed' });
                            logger.warn(`Could not construct app in ${dirent.name} - ${err.message}`);
                        }
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
