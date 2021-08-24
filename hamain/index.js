"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaMain = void 0;
const events_1 = __importDefault(require("events"));
const itemsmanager_1 = require("./itemsmanager");
const path = __importStar(require("path"));
const fs_1 = __importDefault(require("fs"));
const log4js_1 = require("log4js");
const hainterface_1 = require("../hainterface");
const haitems_1 = require("../haitems");
//import * as hound  from 'hound';
var reload = require('require-reload');
const CATEGORY = 'HaMain';
var logger = log4js_1.getLogger(CATEGORY);
if (process.env.HAMAIN_LOGGING) {
    logger.level = process.env.HAMAIN_LOGGING;
}
class HaMain extends events_1.default {
    constructor(config) {
        super();
        this._haInterface = null;
        this._items = new itemsmanager_1.ItemsManager();
        this._apps = new Array();
        this._haItemFactory = null;
        this._config = config;
        this._stopping = false;
        this._haConfig = null;
        this._starttime = new Date();
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._haInterface = new hainterface_1.HaInterface(this._config.main.url, this._config.main.accessToken);
                this._haItemFactory = new haitems_1.HaItemFactory();
                yield this._haInterface.start();
                this._haConfig = yield this._haInterface.getConfig();
                this._processItems(yield this._haInterface.getStates());
                yield this._haInterface.subscribe();
                this._haInterface.on('state_changed', (state) => __awaiter(this, void 0, void 0, function* () {
                    if (this._items.getItem(state.entity_id)) {
                        if (state.new_state != null) {
                            logger.trace(`${state.entity_id} New state: ${state.new_state.state}`);
                            this.items.getItem(state.entity_id).setReceivedState(state.new_state);
                        }
                        else {
                            logger.info(`Item ${state.entity_id} has been dropped`);
                            this.items.deleteItem(state.entity_id);
                        }
                    }
                    else {
                        logger.warn(`Item ${state.entity_id} not found - refreshing devices`);
                        this._processItems(yield this._haInterface.getStates());
                    }
                }));
                this._haInterface.on('reconnected', () => __awaiter(this, void 0, void 0, function* () {
                    yield this._haInterface.subscribe();
                }));
                this._haInterface.on('fatal_error', (err) => {
                    logger.fatal(`Transport layer reports fatal error - ${err.message}`);
                    process.exit(4);
                });
                logger.info(`Items loaded: ${Object.keys(this._items.items).length}`);
                let itemTypes = {};
                Array.from(this._items.items.values()).forEach((value) => {
                    if (!(value.type in itemTypes)) {
                        itemTypes[value.type] = 0;
                    }
                    itemTypes[value.type] += 1;
                });
                Object.keys(itemTypes).forEach((value, _index) => {
                    logger.info(`${value}: ${itemTypes[value]}`);
                });
                let appPromises = [];
                this._config.main.appsDir.forEach((item) => __awaiter(this, void 0, void 0, function* () {
                    this._setWatcher(item);
                    appPromises.push(this._getApps(this._config.main.ignoreApps, item));
                }));
                Promise.all(appPromises)
                    .then((results) => {
                    results.forEach(result => this._apps = this._apps.concat(result));
                    // Construct all apps
                    this._apps.forEach((app) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            if (app.status == 'constructed') {
                                yield app.instance.run();
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
                    }));
                    logger.info(`Apps loaded: ${this._apps.length}`);
                });
            }
            catch (err) {
                logger.error(`Error: ${err}`);
                logger.info(`Stack:\n${err.stack}`);
                throw err;
            }
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this._stopping = true;
                this._apps.forEach((app) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield app.instance.stop();
                        app.status = 'stopped';
                    }
                    catch (err) {
                        logger.warn(`Failed to stop app ${app}: ${err.message}`);
                        app.status = 'failed';
                    }
                }));
                try {
                    if (this._haInterface.isConnected) {
                        yield this._haInterface.stop();
                    }
                    resolve();
                }
                catch (err) {
                    logger.error(`Error: ${err}`);
                    logger.info(`Stack:\n${err.stack}`);
                    reject(err);
                }
            }));
        });
    }
    get items() {
        return this._items;
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
        return this._haInterface
            ? this._haInterface.isConnected
            : false;
    }
    restartHA() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._haInterface.callService('homeassistant', 'restart', {});
        });
    }
    stopHA() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._haInterface.callService('homeassistant', 'stop', {});
        });
    }
    _processItems(states) {
        states.forEach((item) => {
            logger.trace(`Item name: ${item.entity_id}`);
            if (!this.items.getItem(item.entity_id)) {
                let itemInstance = this._haItemFactory.getItemObject(item, this._haInterface);
                itemInstance.on('callservice', (domain, service, data) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this._haInterface.callService(domain, service, data);
                    }
                    catch (err) {
                        // Error already logged
                    }
                }));
                this._items.addItem(itemInstance);
            }
        });
    }
    /*
        private async _reconnect(err: Error): Promise<void> {
            return new Promise(async (resolve, _reject) => {
                if (this._stopping || err) {
                    let connected = false;
    
                    while (!connected) {
    
                        try {
                            await this._haInterface.start();
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
    */
    /*
        private async _wait(seconds: number): Promise<void> {
            return new Promise(resolve => setTimeout(resolve, seconds * 1000));
        }
    */
    _setWatcher(_item) {
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
    _getApps(ignoreApps, appsDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            let ret = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var e_1, _a;
                try {
                    let apps = new Array();
                    const dir = yield fs_1.default.promises.opendir(appsDirectory);
                    let appobject;
                    try {
                        for (var dir_1 = __asyncValues(dir), dir_1_1; dir_1_1 = yield dir_1.next(), !dir_1_1.done;) {
                            const dirent = dir_1_1.value;
                            if (dirent.isDirectory()) {
                                let location = path.join(dir.path, dirent.name);
                                if (ignoreApps.includes(location)) {
                                    logger.info(`App ${dirent.name} ignored`);
                                }
                                else {
                                    let fullname = path.join(dir.path, dirent.name, 'index.js');
                                    fs_1.default.access(fullname, (err) => {
                                        if (!err) {
                                            let app = reload(fullname);
                                            try {
                                                let loc = path.join(dir.path, dirent.name);
                                                if (!this._config[dirent.name]) {
                                                    logger.warn(`Ignoring ${dirent.name} - no config`);
                                                }
                                                else {
                                                    appobject = new app(this, this._config);
                                                    if (appobject.validate == undefined || appobject.validate(this._config[dirent.name])) {
                                                        apps.push({ name: appobject.constructor.name, path: loc, instance: appobject, status: 'constructed' });
                                                    }
                                                    else {
                                                        apps.push({ name: appobject.constructor.name, path: loc, instance: appobject, status: 'bad_config' });
                                                    }
                                                }
                                            }
                                            catch (err) {
                                                apps.push({ name: appobject === null || appobject === void 0 ? void 0 : appobject.constructor.name, path: path.join(dir.path, dirent.name), instance: appobject, status: 'failed' });
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
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (dir_1_1 && !dir_1_1.done && (_a = dir_1.return)) yield _a.call(dir_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    resolve(apps);
                }
                catch (err) {
                    reject(err);
                }
            }));
            return ret;
        });
    }
}
exports.HaMain = HaMain;
//# sourceMappingURL=index.js.map