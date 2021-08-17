"use strict";

import EventEmitter from 'events';
import { ItemsManager } from './itemsmanager';
import * as path from 'path';
// var path = require('path');
import fs from 'fs';
import { Logger, getLogger } from 'log4js';
//var log4js = require('log4js');
var HaInterface = require('../hainterface');
import { HaItemFactory } from '../haitems'
//var HaItemFactory = require('../haitems');
//const { ItemsManager } = require('./itemsmanager');
var reload = require('require-reload');
var hound = require('hound');
import { HaParentItem, ServiceTarget } from '../haitems/haparentitem';
import { Dir } from 'node:fs';
//import * as hound  from 'hound';


type AppInfo = {
    name: string;
    path: string;
    instance: any;
    status: string;
}

const CATEGORY: string = 'HaMain';
var logger: Logger = getLogger(CATEGORY);

if (process.env.HAMAIN_LOGGING) {
    logger.level = process.env.HAMAIN_LOGGING;
}

export class HaMain extends EventEmitter {
    haInterface: any;               // TODO
    _items: ItemsManager;
    config: any;
    _apps: Array<AppInfo>;                    // TODO
    haItemFactory: HaItemFactory;
    stopping: boolean;
    _haConfig: any;
    _starttime: Date;
    constructor(config) {
        super();
        this.haInterface = null;
        this._items = new ItemsManager();
        this._apps = new Array<AppInfo>();
        this.haItemFactory = null;
        this.config = config;
        this.stopping = false;
        this._haConfig = null;
        this._starttime = new Date();
    }

    _processItems(states) {
        states.forEach((item) => {
            logger.trace(`Item name: ${item.entity_id}`);
            if (!this.items.getItem(item.entityId)) {
                let itemInstance: HaParentItem = this.haItemFactory.getItemObject(item, this.haInterface);
                itemInstance.on('callservice', async (domain: string, service: string, data: ServiceTarget) => {
                    try {
                        await this.haInterface.callService(domain, service, data)
                    }
                    catch (err) {
                        // Error already logged
                    }
                });
                this._items.addItem(itemInstance);
            }
        });
    }

    async start() {
        try {
            this.haInterface = new HaInterface(this.config.main.url, this.config.main.accessToken);
            this.haItemFactory = new HaItemFactory();
            await this.haInterface.start();
            this._haConfig = await this.haInterface.getConfig();
            this._processItems(await this.haInterface.getStates());

            await this.haInterface.subscribe();
            this.haInterface.on('state_changed', async (state) => {         // TODO define state type
                // let name = state.entity_id.split('.')[1];

                if (this._items.getItem(state.entity_id)) {
                    if (state.new_state != null) {
                        logger.trace(`${state.entity_id} New state: ${state.new_state.state}`);
                        this.items.getItem(state.entity_id).setReceivedState(state.new_state);
                    }
                    else {
                        logger.info(`Item ${state.entity_id} has been dropped`);
                        this.items.deleteItem(state.entityId);
                    }
                }
                else {
                    logger.warn(`Item ${state.entity_id} not found - refreshing devices`);
                    this._processItems(await this.haInterface.getStates());
                }
            });

            this.haInterface.on('reconnected', async () => {
                await this.haInterface.subscribe();
            });

            this.haInterface.on('fatal_error', (err) => {
                logger.fatal(`Transport layer reports fatal error - ${err.message}`);
                process.exit(4);
            });

            logger.info(`Items loaded: ${Object.keys(this._items.items).length}`);

            let itemTypes = {};
            
            Object.values(this._items.items).forEach((value, _index) => {
                if (!(value.type in itemTypes)) {
                    itemTypes[value.type] = 0;
                }
                itemTypes[value.type] += 1;
            });

            Object.keys(itemTypes).forEach((value, _index) => {
                logger.info(`${value}: ${itemTypes[value]}`);
            }); 

            let appPromises: Promise<AppInfo[]>[] = [];
            this.config.main.appsDir.forEach(async (item: string) => {
                this._setWatcher(item);
            
                appPromises.push(this._getApps(this.config.main.ignoreApps, item));
            });

            Promise.all(appPromises)
                .then((results) => {
                    results.forEach(result => this._apps = this._apps.concat(result));
                    // Construct all apps
                    this._apps.forEach(async (app) => {
                        try {
                            if (app.status == 'constructed') {
                                await app.instance.run();
                                app.status = 'running';
                            }
                            else {
                                logger.warn(`App is not in a runnable state ${app.name} - ${app.status}`);
                            }
                        }
                        catch (err) {
                            app.status = 'failed';
                            logger.warn(`Could not run app ${app.name} - ${err}`);
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
        return new Promise<void>(async (resolve, reject) => {
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

    getApp(name) {
        return this.apps.find(item => item.name == name);
    }

    get haConfig() {
        return this._haConfig;
    }

    get startTime() {
        return this._starttime;
    }

    get isConnected() {
        return this.haInterface
            ? this.haInterface.isConnected 
            : false;
    }

    async restartHA() {
        await this.haInterface.callService('homeassistant', 'restart', {});
    }

    async stopHA() {
        await this.haInterface.callService('homeassistant', 'stop', {});
    }

    async _reconnect(err): Promise<void> {
        return new Promise(async (resolve, _reject) => {
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

                resolve();
            }
        });
    }

    async _wait(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    _setWatcher(item) {
/*        
        hound.watch(item)
            .on('create', (file, stats) => {
                if (this._isApp(this.config.main.appsDir, file, stats)) {
                    logger.debug(`App ${file} created - will attempt to load`);
                    let appobject;
                    try {
                        let app = reload(file);
                        appobject = new app(this, this.config);
                        this._apps.push({ name: appobject.__proto__.constructor.name, path: path.dirname(file), instance: appobject, status: 'constructed' });
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
            .on('change', async (file, stats) => {
                if (this._isApp(this.config.main.appsDir, file, stats)) {
                    logger.debug(`App ${file} changed - will attempt to reload`);
                    let appIndex = this._apps.findIndex(element => path.join(element.path, 'index.js') == file);
                    
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
                if (this._isApp(this.config.main.appsDir, file)) {
                    logger.debug(`App ${file} deleted - will stop and remove`);
                    let appIndex = this._apps.findIndex(element => path.join(element.path, 'index.js') == file);

                    if (appIndex != -1) {
                        let app = this._apps.splice(appIndex, 1);
                        if (app.status == 'running') {
                            await app.instance.stop();
                            logger.info(`App ${file} stopped`);
                        }
                    }
                }
            });
*/
    }

    _isApp(appsDir: [string], file: string, stats?: any) {
        stats = stats ?? { isFile: () => { return true; } }
        return stats.isFile() && path.basename(file) == 'index.js' && 1 == appsDir.filter(item => file.startsWith(item) && file.endsWith(path.relative(item, file))).length;
        // if (stats.isFile() && path.basename(file) == 'index.js' && 1 == appsDir.filter(item => file.startsWith(item) && file.endsWith(path.relative(item, file))).length) {
        //     return true;
        // }
        // else {
        //     return false;
        // }
    }
    
    async _getApps(ignoreApps, appsDirectory): Promise<AppInfo[]> {
        let ret = new Promise<AppInfo[]>(async (resolve, reject) => {
            try {
                let apps: AppInfo[] = new Array<AppInfo>();
                const dir: Dir = await fs.promises.opendir(appsDirectory);
                let appobject;

                for await (const dirent of dir) {
                    if (dirent.isDirectory()) {
                        let location: string = path.join(dir.path, dirent.name);
                        if (ignoreApps.includes(location)) {
                            logger.info(`App ${dirent.name} ignored`);
                        }
                        else {
                            let fullname: string = path.join(dir.path, dirent.name, 'index.js');
                            fs.access(fullname, (err) => {
                                if (!err) {
                                    let app = reload(fullname);
                                    try {
                                        let loc: string = path.join(dir.path, dirent.name);
                                        if (!this.config[dirent.name]) {
                                            logger.warn(`Ignoring ${dirent.name} - no config`);
                                        }
                                        else {
                                            appobject = new app(this, this.config);
                                            if (appobject.validate == undefined || appobject.validate(this.config[dirent.name])) {
                                                apps.push({ name: appobject.__proto__.constructor.name, path: loc, instance: appobject, status: 'constructed' });
                                            }
                                            else {
                                                apps.push({ name: appobject.__proto__.constructor.name, path: loc, instance: appobject, status: 'bad_config' });
                                            }
                                        }
                                    }
                                    catch (err) {
                                        apps.push({ name: appobject?.__proto__.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'failed' });
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

// module.exports = HaMain;
