"use strict";

import EventEmitter from 'events';
import * as path from 'path';
import fs /*, { stat }*/ from 'fs';
import { Dir } from 'node:fs';

import { State, StateChange } from './state';
import { ItemsManager } from './itemsmanager';
import { Logger, getLogger } from 'log4js';
import { HaInterface } from '../hainterface';
import { HaItemFactory } from '../haitems'
import { IHaItem } from '../haitems/ihaitem';
import { ServiceTarget } from '../haitems/haparentitem';
import { IApplication } from '../common/IApplication';
import { LogLevelValidator } from '../common/loglevelvalidator';
import { AppInfo } from './appinfo';

//import * as hound  from 'hound';
var reload = require('require-reload');

const CATEGORY: string = 'HaMain';
var logger: Logger = getLogger(CATEGORY);

export enum SensorType {
    normal,
    binary
}

export class HaMain extends EventEmitter {
    private _haInterface: HaInterface = null;
    private _items: ItemsManager = new ItemsManager();
    private _config: any;
    private _apps: Array<AppInfo> = new Array<AppInfo>();
    private _haItemFactory: HaItemFactory = null;
    private _haConfig: any = null;
    private _starttime: Date = new Date();
    private _configPath;
    private _reconnect: boolean = false;
    constructor(config: any, configPath: string) {
        super();
        this._config = config;
        this._configPath = configPath;

        if (process.env.HAMAIN_LOGGING) {
            logger.level = process.env.HAMAIN_LOGGING;
            logger.log(logger.level, 'Logging level overridden');
        }
    }

    public async start(): Promise<void> {
        try {
            this._haInterface = new HaInterface(this._config.main.hostname ?? '127.0.0.1', this._config.port ?? 8123, this._config.main.accessToken);
            this._haInterface.on('serviceevent', async (eventType: string, data: any) => {
                if (eventType == 'state_changed') {
                    let state: StateChange = data;
                    if (this._items.getItem(state.entity_id)) {
                        if (state.new_state != null) {
                            logger.trace(`${state.entity_id} New state: ${state.new_state.state}`);
                            this.items.getItem(state.entity_id).setReceivedState(state.new_state);
                        }
                        else {
                            logger.info(`Item ${state.entity_id} has been dropped`);
                            let item = this.items.getItem(state.entity_id);
                            this.items.deleteItem(state.entity_id);
                            this.emit('itemdeleted', item);
                        }
                    }
                    else {
                        // It may have just been deleted
                        if (state.new_state != null) {
                            logger.debug(`Item ${state.entity_id} not found - will be added`);
                        }
                        // logger.error(`Item ${state.entity_id} not found - this should not happen`);
                        // this._processItems(await this._haInterface.getStates());
                    }
                }
                else if (eventType == 'call_service') {
                    logger.debug(`Call Service ${JSON.stringify(data, null, 4)}`);
                    logger.debug(`Ignored event "${eventType}"`)
                }
                else if (eventType == 'entity_registry_updated') {
                    if (data.action == 'create') {
                        logger.info(`Adding new device ${data.entity_id}`);
                        let item = ((await this._haInterface.getStates()).filter((value: any) => value.entity_id == data.entity_id))[0];
                        let itemInstance: IHaItem = this._haItemFactory.getItemObject(item);
                        this._setupItem(itemInstance); 
                    }
                    else if (data.action == 'remove') {
                        logger.info(`Removing deleted device ${data.entity_id}`);
                        let item = this.items.getItem(data.entity_id);
                        this.items.deleteItem(data.entity_id);
                        this.emit('itemdeleted', item);
                }
                    else {
                        // TODO: Handle this
                        logger.debug(`${eventType} unhandled: ${JSON.stringify(data, null, 4)}`)
                    }
                }
                else {
                    logger.debug(`Event "${eventType}"\n${JSON.stringify(data, null, 4)}`);
                }
                this.emit('serviceevent', eventType, data);
            });

            this._haInterface.on('connected', async () => {
                if (this._reconnect) {
                    this._processItems(await this._haInterface.getStates());
                }
                else {
                    await this._haInterface.subscribe();
                    logger.info('Subscribed to events');
                    this._reconnect = false;
                }
            });

            this._haInterface.on('fatal_error', (err) => {
                logger.fatal(`Transport layer reports fatal error - ${err.message}`);
                process.exit(4);
            });
            this._haItemFactory = new HaItemFactory(this._config);
            await this._haInterface.start();
            this._haConfig = await this._haInterface.getConfig();
            this._processItems(await this._haInterface.getStates());
            logger.info(`Items loaded: ${Array.from(this._items.items.values()).length}`);

            let itemTypes: any = {};
            
            Array.from(this._items.items.values()).forEach((value: IHaItem) => {
                if (!(value.type in itemTypes)) {
                    itemTypes[value.type] = 0;
                }
                itemTypes[value.type] += 1;
            });

            Object.keys(itemTypes).sort().forEach((value, _index) => {
                logger.info(`${value}: ${itemTypes[value]}`);
            }); 

            let appPromises: Promise<AppInfo[]>[] = [];
            this._config.main.appsDir.forEach(async (item: string) => {
                this._setWatcher(item);
            
                appPromises.push(this._getApps(this._config.main.ignoreApps, item));
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

    public async stop() {
        return new Promise<void>(async (resolve, reject) => {
            this._apps.forEach(async (app) => {
                try {
                    if (app) {
                        await app.instance.stop();
                        app.status = 'stopped';
                    }
                }
                catch (err) {
                    logger.warn(`Failed to stop app ${app}: ${err.message}`);
                    app.status = 'failed';
                }
            });
            try {
                if (this._haInterface.isConnected) {
                    await this._haInterface.stop();
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

    public async addSensor(name: string, type: SensorType, value: boolean | string | number): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (type == SensorType.binary) {
                value = !!value;
                name = 'binary_sensor.' + name;
            }
            else {
                name = 'sensor.' + name
            }
    
            if (this.items.getItem(name)) {
                throw new Error(`${name} already exists`);
            }

            let addComplete = async (name: string): Promise<void> => {
                return new Promise((resolve, reject) => {
                    let timer: NodeJS.Timer = setTimeout(() => {
                        this.off('itemadded', waitadd);
                        reject(new Error('Timeout awaiting addition of new item'));
                    }, 5000);
                    let waitadd = (item: IHaItem) => {
                        if (item.entityId == name) {
                            this.off('itemadded', waitadd);
                            clearTimeout(timer);
                            resolve();
                        }
                    };
                    this.on('itemadded', waitadd);
                });
            };
            try {
                await this._haInterface.addSensor(name, value);
                await addComplete(name);
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }

    public get configPath(): string {
        return this._configPath;
    }

    public get items(): ItemsManager {
        return this._items
    }

    public get apps() {
        return this._apps;
    }

    public getApp(name: string): AppInfo {
        return this.apps.find(item => item.name == name);
    }

    public get haConfig() {
        return this._haConfig;
    }

    public get startTime(): Date {
        return this._starttime;
    }

    public get isConnected(): boolean {
        return this._haInterface
            ? this._haInterface.isConnected 
            : false;
    }

    public get logging(): string {
        return logger.level;
    }

    public set logging(value: string) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            logger.error(err.message);
            throw err;
        }
        else {
            logger.level = value;
        }
    }

    public async restartHA(): Promise<void> {
        await this._haInterface.callService('homeassistant', 'restart', {});
    }

    public async stopHA(): Promise<void> {
        await this._haInterface.callService('homeassistant', 'stop', {});
    }

    private _processItems(states: State[]) {
        states.forEach((item) => {
            let work: IHaItem;
            if (!(work = this.items.getItem(item.entity_id))) {
                let itemInstance: IHaItem = this._haItemFactory.getItemObject(item /*, this._haInterface*/);
                this._setupItem(itemInstance); 
            }
            else {
                work.setReceivedState({ entity_id: item.entity_id, state: item.state, attributes: item.attributes, context: item.context, last_changed: item.last_changed, last_updated: item.last_updated });
            }
        });
    }

    private _setupItem(itemInstance: IHaItem): void {
        itemInstance.on('callservice', async (domain: string, service: string, data: ServiceTarget) => {
            try {
                await this._haInterface.callService(domain, service, data)
            }
            catch (err) {
                // Error already logged
            }
        });
        itemInstance.on('callrestservice', async (entityId: string, state: string | boolean | number) => {
            try {
                await this._haInterface.updateSensor(entityId, state);
            }
            catch (err) {
                logger.error(err.message);
            }
        });
        this._items.addItem(itemInstance);
        this.emit('itemadded', this.items.getItem(itemInstance.entityId));
}

    private _setWatcher(_item: unknown) {
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
/*
    private _isApp(appsDir: string[], file: string, stats?: any) {
        stats = stats ?? { isFile: () => { return true; } }
        return stats.isFile() && path.basename(file) == 'index.js' && 1 == appsDir.filter(item => file.startsWith(item) && file.endsWith(path.relative(item, file))).length;
        // if (stats.isFile() && path.basename(file) == 'index.js' && 1 == appsDir.filter(item => file.startsWith(item) && file.endsWith(path.relative(item, file))).length) {
        //     return true;
        // }
        // else {
        //     return false;
        // }
    }
*/
    private async _getApps(ignoreApps: string[], appsDirectory: string): Promise<AppInfo[]> {
        let ret = new Promise<AppInfo[]>(async (resolve, reject) => {
            try {
                let apps: AppInfo[] = new Array<AppInfo>();
                const dir: Dir = await fs.promises.opendir(appsDirectory);
                let appobject: IApplication;

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
                                    let app = reload(fullname).default;
                                    try {
                                        let loc: string = path.join(dir.path, dirent.name);
                                        if (!this._config[dirent.name]) {
                                            logger.warn(`Ignoring ${dirent.name} - no config`);
                                        }
                                        else {
                                            appobject = new app(this, this._config);
                                            if (appobject.validate == undefined || appobject.validate(this._config[dirent.name])) {
                                                appobject.on('callservice', async (domain: string, service: string, data: ServiceTarget) => {
                                                    try {
                                                        await this._haInterface.callService(domain, service, data)
                                                    }
                                                    catch (err) {
                                                        // Error already logged
                                                    }
                                                });
                                                apps.push({ name: appobject.constructor.name, path: loc, instance: appobject, status: 'constructed' });
                                            }
                                            else {
                                                apps.push({ name: appobject.constructor.name, path: loc, instance: appobject, status: 'bad_config' });
                                            }
                                        }
                                    }
                                    catch (err) {
                                        apps.push({ name: appobject?.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'failed' });
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
