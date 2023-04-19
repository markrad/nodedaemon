import YAML, { ScalarTag } from "yaml";
import path from 'path';
import fs from 'fs';
import EventEmitter from "events";
const hound = require('hound');
import { Logger, getLogger } from 'log4js';
const DEFAULT_CONFIG_NAME = './config.yaml';

const CATEGORY: string = 'ConfigWrapper';
var logger: Logger = getLogger(CATEGORY);

export interface IConfigWrapperEvents {
    'new': (key: string) => void;
    'changed': (key: string) => void;
}

export declare interface ConfigWrapper {
    on<U extends keyof IConfigWrapperEvents>(event: U, listner: IConfigWrapperEvents[U]): this;
    emit<U extends keyof IConfigWrapperEvents>(event: U, ...args: Parameters<IConfigWrapperEvents[U]>): boolean;
}

export class ConfigWrapper extends EventEmitter {
    private _filename: string;
    private _config: any;
    private _watchers: any[] = [];
    constructor(filename: string) {
        super();
        this._filename = path.resolve(filename ?? DEFAULT_CONFIG_NAME);
        this._config = this._getConfig();
    }

    private _countProps: (o: Object) => number = (o: Object): number => {
        let count: number = 0;
        for (let k in o) {
            if (o.hasOwnProperty(k)) count++;
        }
        return count;
    }

    private _objectEquals: (l: any, r: any) => boolean = (l, r): boolean => {
        if (l instanceof Object && r instanceof Object) {
            if (this._countProps(l) != this._countProps(r)) return false;
            let ret: boolean;
            for (let k in l) {
                ret = this._objectEquals(l[k], r[k]);
                if (!ret) return false;
            }
            return true;
        }
        else {
            return l == r;
        }
    }

    public cleanup(): void {
        this._watchers.forEach((watcher: any) => {
            watcher.clear();
        });
        this._watchers = [];
    }

    private _getConfig(): any {
        let handler = async (_file: string, _stats: any) => {
            let oldConfig = this._config;
            this._config = this._getConfig();
            for (let key in this._config) {
                if (key != 'main') {
                    if (oldConfig[key] === undefined) {
                        logger.info(`New application found: ${key} - to load a restart is required`);
                        this.emit('new', key);
                    }
                    else if (!this._objectEquals(oldConfig[key], this._config[key])) {
                        logger.info(`Found config update for application ${key}`);
                        this.emit('changed', key);
                    }
                }
            }
        }

        this.cleanup();
        this._watchers.push(hound.watch(this.configFullName));
        let secrets: any = {};
        let config: any = {};
        const secret: ScalarTag = {
            identify: value => value instanceof String,
            default: false,
            tag: '!secret',
            resolve(str) {
                if (!secrets[str]) {
                    throw new Error(`Secret ${str} not found`);
                }
                else {
                    return secrets[str];
                }
            },
        }
        const include: ScalarTag = {
            identify: value => value instanceof String,
            default: false,
            tag: '!include',
            resolve: (str) => {
                let fullName: string = path.join(this.configPath, str);
                let inc: any = YAML.parse(fs.readFileSync(fullName, 'utf8'), { customTags: [ secret, include ] });
                this._watchers.push(hound.watch(fullName));
                return inc;
            }
        }
        
        secrets = YAML.parse(fs.readFileSync(path.join(this.configPath, 'secrets.yaml'), 'utf8'));
        config = YAML.parse(fs.readFileSync(this.configFullName, 'utf8'),  { customTags: [ secret, include ] });
        this._watchers.forEach((watcher) => watcher.on('change', handler));
        return config;
    }

    get configPath(): string {
        return path.dirname(this._filename);
    }

    get configFileName(): string {
        return path.basename(this._filename);
    }

    get configFullName(): string {
        return this._filename;
    }

    get config(): any {
        return this._config;
    }

    getConfigSection(section: string) {
        return this._config[section];
    }
}