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
Object.defineProperty(exports, "__esModule", { value: true });
const haparentitem_1 = require("../../haitems/haparentitem");
const log4js_1 = require("log4js");
const https = __importStar(require("https"));
const CATEGORY = 'DynDnsUpdater';
const ONE_DAY = 86400;
var logger = log4js_1.getLogger(CATEGORY);
class DynDnsUpdater {
    constructor(controller, config) {
        this._errors = new Map([
            ['badauth', 'DynDns authorization is invalid'],
            ['notfqdn', 'This hostname not fully qualified'],
            ['nohost', 'The host name is missing or invalid'],
            ['numhost', 'Attempted to update too many hosts in one call'],
            ['abuse', 'The specified host name has been blocked for abuse'],
            ['dnserr', 'Bad user name or password'],
            ['911', 'Bad user name or password'],
        ]);
        this._url = null;
        // TODO Use a config file
        this._external_ip = haparentitem_1.SafeItemAssign(controller.items.getItem('var.external_ip'));
        this._lastUpdate = haparentitem_1.SafeItemAssign(controller.items.getItem('var.last_dns_update'));
        this._user = config.dyndnsupdater.user;
        this._updaterKey = config.dyndnsupdater.updaterKey;
        this._hostname = config.dyndnsupdater.hostname;
        logger.debug('Constructed');
    }
    validate(_config) {
        try {
            if (this._external_ip == undefined)
                throw new Error('Could not find externalIp item');
            if (this._lastUpdate == undefined)
                throw new Error('Could not find lastUpdate item');
            if (!this._user)
                throw new Error('user not found in config file');
            if (!this._updaterKey)
                throw new Error('updaterKey not found in config file');
            if (!this._hostname)
                throw new Error('hostname not found in config file');
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }
        this._url = `https://${this._user}:${this._updaterKey}@members.dyndns.org/v3/update?hostname=${this._hostname}&myip=`;
        return true;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this._external_ip.on('new_state', (item, oldState) => {
                    let now = new Date();
                    let then = new Date(this._lastUpdate.state);
                    if (isNaN(then.getDate())) {
                        then = new Date(0);
                    }
                    // Update when IP address changes or at least once every 24 hours
                    if (now.valueOf() / 1000 - then.valueOf() / 1000 > ONE_DAY || item.state != oldState.state) {
                        logger.info(`Updating DynDNS IP address to ${item.state}`);
                        let allchunks = '';
                        let options = {
                            headers: {
                                'User-Agent': 'Radrealm - HassTest - v0.0.1'
                            }
                        };
                        https.get(this._url + item.state, options, (res) => {
                            res.setEncoding('utf8');
                            res.on('data', (chunk) => allchunks += chunk);
                            res.on('end', () => {
                                logger.debug(`DynDns response: ${allchunks}`);
                                let rc = allchunks.split(' ')[0];
                                switch (rc) {
                                    case 'good':
                                    case 'nochg':
                                        // HACK Must be a better way to do this
                                        let nowString = now.getFullYear() + '-' +
                                            (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                                            now.getDate().toString().padStart(2, '0') + ' ' +
                                            now.getHours().toString().padStart(2, '0') + ':' +
                                            now.getMinutes().toString().padStart(2, '0') + ':' +
                                            now.getSeconds().toString().padStart(2, '0');
                                        this._lastUpdate.updateState(nowString);
                                        logger.info(`DynDns IP address successfully updated to ${item.state}`);
                                        break;
                                    default:
                                        if (this._errors.has(rc)) {
                                            logger.error(this._errors.get(rc));
                                        }
                                        else {
                                            logger.error(`Update failed with unrecognized code: ${allchunks}`);
                                        }
                                }
                            });
                        }).on('error', (err) => {
                            logger.error(`Failed to update IP address: ${err}`);
                            reject(err);
                        });
                    }
                });
                resolve(true);
            });
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
}
module.exports = DynDnsUpdater;
//# sourceMappingURL=index.js.map