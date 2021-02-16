const EventEmitter = require('events');
var path = require('path');
const fs = require('fs');
var log4js = require('log4js');
var HaInterface = require('../hainterface');
var HaItemFactory = require('../haitems');
var reload = require('require-reload');
const hound = require('hound');

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
        this._starttime = new Date();
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

            await this.haInterface.subscribe();
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

            this.haInterface.on('reconnected', async () => {
                await this.haInterface.subscribe();
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

            let appPromises = []
            this.config.main.appsDir.forEach(async (item) => {
                this._setWatcher(item);
            
                appPromises.push(this._getApps(this.config.main.ignoreApps, item));
            });

            Promise.all(appPromises)
                .then((results) => {
                    results.forEach(result => this._apps = this._apps.concat(result));
                    // Construct all apps
                    let goodapps = 0;
                    this._apps.forEach((app) => {
                        try {
                            app.instance.run();
                            app.status = 'running';
                            goodapps++;
                        }
                        catch (err) {
                            app.status = 'failed';
                            logger.warn(`Could not run app ${app.__proto__.constructor.name} - ${err}`);
                        }
                    });
                    logger.info(`Apps loaded: ${this._apps.length}`);
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

    getItemByFriendlyName(name) {
        let index = Object.keys(this.items).findIndex((item) => { 
            logger.debug(this.items[item].attributes.friendly_name);
            return this.items[item].attributes.friendly_name == name
        });

        return index != -1? Object.values(this.items)[index] : null;
    }

    get items() {
        return this._items
    }

    get apps() {
        return this._apps;
    }

    getApp(name) {
        return this.apps.find(item => item.name == name);
    }

    get haConfig() {
        return this._haConfig;
    }

    get startTime() {
        return this._starttime;
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

    _setWatcher(item) {
        hound.watch(item)
            .on('create', (file, _stats) => {
                if (this.config.main.appsDir.includes(path.dirname(file)) && path.basename(file) == 'index.js') {
                    logger.debug(`App ${file} created - will attempt to load`);
                    let appobject;
                    try {
                        let app = reload(file);
                        appobject = new app(this, this.config);
                        this._apps.push({ name: appobject.__proto__.constructor.name, path: path.join(file), instance: appobject, status: 'constructed' });
                        appobject.run();
                        this._apps[this.apps.length - 1].status = 'running';
                        logger.info(`App ${file} loaded`);
                    }
                    catch (err) {
                        this._apps.push({ name: appobject.__proto__.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'failed' });
                        logger.warn(`Could not construct app in ${dirent.name} - ${err.message}`);
                    }
                }
            })
            .on('change', async (file, _stats) => {
                if (this.config.main.appsDir.includes(path.dirname(file)) && path.basename(file) == 'index.js') {
                    logger.debug(`App ${file} changed - will attempt to reload`);
                    let appIndex = this._apps.findIndex(element => element.path == file);
                    
                    if (appIndex != -1) {
                        let appEntry = this._apps[appIndex];
                        if (appEntry.status == 'running') {
                            await appEntry.instance.stop();
                        }
                        try {
                            let appObject = reload(file);
                            appEntry.instance = new appObject(this, this.config);
                            appEntry.instance.run();
                            appEntry.status = 'running';
                            logger.info(`App ${file} reloaded`);
                        }
                        catch (err) {
                            logger.error(`Failed to refreshh app ${appEntry.name}: ${err}`);
                            appEntry.status = 'failed';
                        }
                    }
                }
            })
            .on('delete', async (file) => {
                if (this.config.main.appsDir.includes(path.dirname(file)) && path.basename(file) == 'index.js') {
                    logger.debug(`App ${file} deleted - will stop and remove`);
                    let appIndex = this._apps.findIndex(element => element.path == file);

                    if (appIndex != -1) {
                        let app = this._apps.splice(appIndex, 1);
                        if (app.status == 'running') {
                            await app.instance.stop();
                            logger.info(`App ${file} stopped`);
                        }
                    }
                }
            });
    }
    
    async _getApps(ignoreApps, appsDirectory) {
        let ret = new Promise(async (resolve, reject) => {
            try {
                let apps = [];
                const dir = await fs.promises.opendir(appsDirectory);
                let appobject;

                for await (const dirent of dir) {
                    if (dirent.isDirectory()) {
                        let location = path.join(dir.path, dirent.name);
                        if (ignoreApps.includes(location)) {
                            logger.debug(`App ${dirent.name} ignored`);
                        }
                        else {
                            let fullname = path.join(dir.path, dirent.name, 'index.js');
                            fs.access(fullname, (err) => {
                                if (!err) {
                                    let app = reload(fullname);
                                    try {
                                        appobject = new app(this, this.config);
                                        apps.push({ name: appobject.__proto__.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'constructed' });
                                    }
                                    catch (err) {
                                        apps.push({ name: appobject.__proto__.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'failed' });
                                        logger.warn(`Could not construct app in ${dirent.name} - ${err.message}`);
                                    }
                                }
                                else {
                                    logger.warn(`Search for index.js in ${dirent.name} failed - ${err}`);
                                }
                            });
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
