"use strict";

import EventEmitter from 'events';
import * as path from 'path';
import fs /*, { stat }*/ from 'fs';
import { Dir } from 'node:fs';

import { State, StateChange } from './state';
import { ItemsManager } from './itemsmanager';
import { Logger, getLogger, Level } from 'log4js';
import { HaInterface } from '../hainterface';
import { HaItemFactory } from '../haitems'
import { IHaItem } from '../haitems/ihaitem';
import { ServiceTarget } from '../haitems/haparentitem';
import { IApplication } from '../common/IApplication';
import { LogLevelValidator } from '../common/loglevelvalidator';
import { AppInfo, AppStatus } from './appinfo';
import { ConfigWrapper } from '../common/ConfigWrapper';

var reload: NodeRequire = require('require-reload');

const CATEGORY: string = 'HaMain';
var logger: Logger = getLogger(CATEGORY);

export enum SensorType {
    normal,
    binary
}

export type LoggerLevel = {
    entityId: string,
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    used: boolean
}

export interface IHaMainEvents {
    'itemdeleted': (item: IHaItem) => void;
    'itemadded': (item: IHaItem) => void;
    'serviceevent': (eventType: string, data: any) => void;
    'appsinitialized': () => void;
    'homeassistantstarted': () => void;
};

export declare interface HaMain {
    on<U extends keyof IHaMainEvents>(event: U, listner: IHaMainEvents[U]): this;
    emit<U extends keyof IHaMainEvents>(event: U, ...args: Parameters<IHaMainEvents[U]>): boolean;
}

export class HaMain extends EventEmitter {
    private static _instance: HaMain = null;
    private _haInterface: HaInterface = null;
    private _items: ItemsManager = new ItemsManager();
    private _config: ConfigWrapper;
    private _apps: AppInfo[] = [];
    private _haItemFactory: HaItemFactory = null;
    private _haConfig: any = null;
    private _starttime: Date = new Date();
    private _reconnect: boolean = false;
    private _version: string = null;
    private _useTLS: boolean;
    private _hostname: string = null;
    private _port: number = NaN;
    private _accessToken: string = null;
    private _pingInterval: number = NaN;
    private _memInterval: number = NaN;
    private _memHandle: NodeJS.Timer = null;
    private _configWatcher: any;
    private _loggerLevels: LoggerLevel[];
    public static getInstance(): HaMain {
        if (!HaMain._instance) {
            throw new Error('Instance of HaMain has not been constructed yet');
        }
        return HaMain._instance;
    }
    constructor(config: ConfigWrapper, version: string) {
        super();
        this._config = config;
        this._version = version;
        this._useTLS = Boolean(this._config.getConfigSection('main').useTLS);
        this._hostname = this._config.getConfigSection('main').hostname ?? '127.0.0.1';
        this._port = this._config.getConfigSection('main').port ?? 8123
        this._accessToken = this._config.getConfigSection('main').accessToken;
        this._pingInterval = this._config.getConfigSection('main').pintInterval ?? 0;
        this._memInterval = this._config.getConfigSection('main').memInterval ?? 0;
        // this._configWatcher = hound.watch(this._configFile);
        this._loggerLevels = this._config.getConfigSection('main').loggerLevelOverrides;

        this._config.on('new', (key) => {
            logger.info(`New application found: ${key} - to load a restart is required`);
        });

        this._config.on('changed', (key) => {
            logger.info(`Found config update for application ${key}`);
            let app: AppInfo = this.getAppByDirent(key);
            if (!app) {
                logger.info(`Application ${key} is in the ignore list`);
            }
            else {
                app.config = this._config.getConfigSection(key);
                
                if (app.status == AppStatus.RUNNING) {
                    this.restartApp(app);
                }
                else {
                    logger.info(`Not starting stopped application ${app.name}`);
                }
            }
        });

        if (process.env.HAMAIN_LOGGING) {
            logger.level = process.env.HAMAIN_LOGGING;
            logger.log(logger.level, `Logging level overridden: ${logger.level}`);
        }

        if (isNaN(this._port)) {
            logger.error(`Specified port ${this._port} is invalid - will try 8123`);
            this._port = 8123;
        }

        if (isNaN(this._pingInterval)) {
            logger.warn(`Ping interval ${this._pingInterval} is invalid - ignored`);
        }

        if (isNaN(this._memInterval)) {
            logger.warn(`Mem interval ${this._memInterval} is invalid - ignored`);
        }

        if (this._loggerLevels) {
            if (!Array.isArray(this._loggerLevels)) {
                this._loggerLevels = [this._loggerLevels];
            }

            let logLevelError = false;

            for (let i = 0; i < this._loggerLevels.length; i++) {
                if (!LogLevelValidator(this._loggerLevels[i].level)) {
                    logger.error(`Missing or invalid log level in ${JSON.stringify(this._loggerLevels[i])}`);
                    this._loggerLevels = null;
                    logLevelError = true;
                }
                if (!this._loggerLevels[i].entityId) {
                    logger.error(`Missing entity id in ${JSON.stringify(this._loggerLevels[i])}`);
                    logLevelError = true;
                }
                this._loggerLevels[i].used = false;
            }

            if (logLevelError) {
                logger.warn('Log level overrides ignored due to errors');
                this._loggerLevels = null;
            }
        }

        HaMain._instance = this;
    }

    public async start(): Promise<void> {
        try {
            if (this._memInterval > 0) {
                var heapUsed: number = 0;
                this._memHandle = setInterval(() => {
                    var mem: NodeJS.MemoryUsage = process.memoryUsage();
                    logger.info(`Used ${Math.round(mem.heapUsed * 100 / mem.heapTotal * 100) / 100}% - change of ${(mem.heapUsed - heapUsed).toLocaleString()} (total: ${mem.heapTotal.toLocaleString()}; used: ${mem.heapUsed.toLocaleString()})`);
                    heapUsed = mem.heapUsed;
                }, this._memInterval * 1000);
            }
            this._haInterface = new HaInterface(this._useTLS, this._hostname, this._port, this._accessToken, this._pingInterval);
            this._haInterface.on('serviceevent', async (eventType: string, data: any) => {
                // if (eventType != 'state_changed') logger.info(`Service Event: ${eventType}`);
                if (eventType == 'state_changed') {
                    let state: StateChange = data;
                    if (this._items.getItem(state.entity_id)) {
                        if (state.new_state != null) {
                            logger.trace(`${state.entity_id} New state: ${state.new_state.state}`);
                            this.items.getItem(state.entity_id).setReceivedState(state.new_state);
                        }
                        else {
                            let item = this.items.getItem(state.entity_id);
                            this.items.deleteItem(state.entity_id);
                            this.emit('itemdeleted', item);
                            logger.info(`Item ${state.entity_id} has been dropped`);
                        }
                    }
                    else {
                        if (state.new_state != null) {
                            let item = ((await this._haInterface.getStates()).filter((value: any) => value.entity_id == data.entity_id))[0];
                            let itemInstance: IHaItem = this._haItemFactory.getItemObject(item);
                            this._setupItem(itemInstance); 
                            logger.info(`Item ${state.entity_id} not found - added`);
                        }
                    }
                }
                else if (eventType == 'call_service') {
                    logger.debug(`Call Service ${JSON.stringify(data, null, 4)}`);
                    logger.debug(`Ignored event "${eventType}"`)
                }
                // else if (eventType == 'entity_registry_updated') {
                //     if (data.action == 'create') {
                //         logger.info(`Adding new device ${data.entity_id}`);
                //         let item = ((await this._haInterface.getStates()).filter((value: any) => value.entity_id == data.entity_id))[0];
                //         let itemInstance: IHaItem = this._haItemFactory.getItemObject(item);
                //         this._setupItem(itemInstance); 
                //     }
                //     else if (data.action == 'remove') {
                //         logger.info(`Removing deleted device ${data.entity_id}`);
                //         let item = this.items.getItem(data.entity_id);
                //         this.items.deleteItem(data.entity_id);
                //         this.emit('itemdeleted', item);
                //     }
                //     else {
                //         // TODO: Handle this
                //         logger.debug(`${eventType} unhandled: ${JSON.stringify(data, null, 4)}`)
                //     }
                // }
                else if (eventType == 'component_loaded') {
                    logger.trace(`${eventType}: ${JSON.stringify(data)}`);
                }
                else if (eventType == 'service_registered') {
                    logger.trace(`${eventType}: ${JSON.stringify(data)}`);
                }
                else if (eventType == 'panels_updated') {
                    logger.trace(`${eventType}: ${JSON.stringify(data)}`);
                }
                else if (eventType == 'homeassistant_start') {
                    logger.trace(`${eventType}: ${JSON.stringify(data)}`);
                }
                else if (eventType == 'core_config_updated') {
                    logger.trace(`${eventType}: ${JSON.stringify(data)}`);
                }
                else if (eventType == 'homeassistant_started') {
                    logger.info(`${eventType}: ${JSON.stringify(data)}`);
                    this.emit('homeassistantstarted');
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

            this._haItemFactory = new HaItemFactory(this._loggerLevels);
            await this._haInterface.start();
            this._haConfig = await this._haInterface.getConfig();
            
            if (this._haConfig.state != 'RUNNING') {
                await this._waitHomeAssistantStarted();
                this._haConfig = await this._haInterface.getConfig();
            }

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
            this._config.getConfigSection('main').appsDir.forEach(async (item: string) => {
            
                appPromises.push(this._getApps(this._config.getConfigSection('main').ignoreApps, item));
            });

            Promise.all(appPromises)
            .then((results) => {
                results.forEach(result => this._apps = this._apps.concat(result));
                // Construct all apps
                this._apps.forEach(async (app) => {
                    await this._startApp(app, this._config.getConfigSection('main').norunApps);
                });
                logger.info(`Apps loaded: ${this._apps.length}`);
                this.emit('appsinitialized');
            });
        }
        catch (err) {
            logger.error(`Error: ${err}`);
            logger.info(`Stack:\n${err.stack}`);
            throw err;
        }
    }

    private async _waitHomeAssistantStarted(): Promise<void> {
        return new Promise<void>((resolve, _reject) => {
            this.once('homeassistantstarted', () => {
                resolve();
            });
        });
    }

    public async restartApp(app: AppInfo): Promise<void> {
        if (app.status == AppStatus.RUNNING) {
            await this.stopApp(app);
        }
        await this.startApp(app);
    }

    public async startApp(app: AppInfo): Promise<void> {
        return await this._startApp(app);
    }

    private async _startApp(app: AppInfo, norunApps?: string[]): Promise<void> {
        try {
            if (app.status != AppStatus.FAILED && app.status != AppStatus.RUNNING) {
                if (app.instance.validate != undefined && app.instance.validate(app.config)) {
                    app.status = AppStatus.VALIDATED;
                    if (norunApps == undefined || !norunApps.includes(app.name)) {
                        await app.instance.run();
                        app.status = AppStatus.RUNNING;
                        logger.info(`Started ${app.name}`);
                    }
                    else {
                        app.status = AppStatus.STOPPED;
                    }
                }
                else {
                    app.status = AppStatus.BADCONFIG;
                }
            }
            else {
                throw new Error(`App is not in a startable state - ${app.status}`);
            }
        }
        catch (err) {
            app.status = AppStatus.FAILED;
            throw new Error(`Failed to start app ${app.name}: ${err.message}`);
        }
    }

    public async stopApp(app: AppInfo): Promise<void> {
        return new Promise<void>(async (resolve, reject) => { 
            try {
                if (app.status == AppStatus.RUNNING) {
                    await app.instance.stop();
                    app.status = AppStatus.STOPPED;
                    logger.info(`Stopped app ${app.name}`);
                    resolve();
                }
            }
            catch (err) {
                app.status = AppStatus.FAILED;
                reject(new Error(`Failed to stop app ${app.name}: ${err.message}`));
            }
        });
    }

    public async stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await this._stopOrRestart(0);
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }

    public async restart(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!process.env['KEEPALIVE_RUNNING']) {
                reject(new Error('Restart only supported when running under keepalive'));
            }
            else {
                try {
                    await this._stopOrRestart(1);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
                }
        });
    }

    private async _stopOrRestart(rc: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this._memHandle != null) {
                clearInterval(this._memHandle);
                this._memHandle = null;
            }
            this._configWatcher.clear();
            this._apps.forEach(async (app) => {
                try {
                    await this.stopApp(app);
                }
                catch (err) {
                    logger.error(`Failed to stop ${app.name} - ${err}`);
                }
            });
            this.items.items.forEach((item) => item.cleanUp());
            try {
                if (this._haInterface.isConnected) {
                    await this._haInterface.stop();
                }
                this.removeAllListeners();
                resolve();
                process.exit(rc);
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
        return this._config.configPath;
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

    public getAppByDirent(name: string): AppInfo {
        return this.apps.find(item => path.basename(item.path) == name);
    }

    public get haConfig() {
        return this._haConfig;
    }

    public get startTime(): Date {
        return this._starttime;
    }

    public get version(): string {
        return this._version;
    }

    public get isConnected(): boolean {
        return this._haInterface
            ? this._haInterface.isConnected 
            : false;
    }

    public get logging(): string | Level {
        return logger.level;
    }

    public set logging(value: string | Level) {
        if (!LogLevelValidator(value)) {
            let err: Error = new Error(`Invalid level passed: ${value}`);
            logger.error(err.message);
            throw err;
        }
        else {
            logger.level = value;
        }
    }

    public get config(): any {
        return this._config;
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
                let itemInstance: IHaItem = this._haItemFactory.getItemObject(item);
                this._setupItem(itemInstance); 
            }
            else {
                work.setReceivedState({ entity_id: item.entity_id, state: item.state, attributes: item.attributes, context: item.context, last_changed: item.last_changed, last_updated: item.last_updated });
            }
        });

        let unusedCnt: number = this._loggerLevels.reduce<number>((count, current) => count += Number(!current.used), 0);

        logger.info(`Number of log overrides not used is ${unusedCnt}`)
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
        itemInstance.on('callrestservice', async (entityId: string, state: string | boolean | number, forceUpdate: boolean) => {
            try {
                let entity = this.items.getItem(entityId);

                if (!entity) {
                    logger.error(`Entity ${entityId} does not exist`);
                    return;
                }
                await this._haInterface.updateSensor(entity, state, forceUpdate);
            }
            catch (err) {
                logger.error(`Update sensor failed: ${err.message}`);
            }
        });
        this._items.addItem(itemInstance);
        this.emit('itemadded', this.items.getItem(itemInstance.entityId));
}

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
                                    let loc: string = path.join(dir.path, dirent.name);
                                    try {
                                        if (this._config.getConfigSection(dirent.name) === undefined) {
                                            logger.warn(`Ignoring ${dirent.name} - no config`);
                                        }
                                        else {
                                            appobject = new app(this, this._config);
                                            appobject.on('callservice', async (domain: string, service: string, data: ServiceTarget) => {
                                                try {
                                                    await this._haInterface.callService(domain, service, data)
                                                }
                                                catch (err) {
                                                    // Error already logged
                                                }
                                            });
                                            apps.push({ name: appobject.constructor.name, path: loc, instance: appobject, status: AppStatus.CONSTRUCTED, config: this._config.getConfigSection(dirent.name) });
                                        }
                                    }
                                    catch (err) {
                                        apps.push({ name: appobject?.constructor.name, path: loc, instance: appobject, status: AppStatus.FAILED, config: this._config.getConfigSection(dirent.name) });
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
