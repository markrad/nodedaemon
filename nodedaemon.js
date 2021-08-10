"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const log4js_1 = require("log4js");
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
var HaMain = require('./hamain');
const CATEGORY = 'main';
function main(version, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const LOGO = `
                                                  
             |         |                         
___  ___  ___| ___  ___| ___  ___  _ _  ___  ___ 
|   )|   )|   )|___)|   )|   )|___)| | )|   )|   )
|  / |__/ |__/ |__  |__/ |__/||__  |  / |__/ |  / 
                                                   Version ${version} is starting
`;
        var logger = log4js_1.getLogger(CATEGORY);
        logger.info(`${LOGO}`);
        try {
            var haMain = new HaMain(config);
            process.stdin.resume();
            ['SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM'].forEach((eventType) => {
                process.on(eventType, (signal) => __awaiter(this, void 0, void 0, function* () {
                    logger.fatal(`Clean up after event ${signal}`);
                    yield haMain.stop();
                    process.exit(eventType == 'SIGTERM' ? 0 : 4);
                }));
            });
            process.on('uncaughtException', (err) => {
                logger.error(`Unhandled error: ${err.message}\n${err.stack}`);
            });
            yield haMain.start();
        }
        catch (err) {
            logger.error(`Error: ${err}`);
            logger.fatal(err.stack);
            process.exit(4);
        }
    });
}
var defaultLogger;
try {
    const program = new commander_1.Command();
    const debugLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const defaultDebug = 3;
    // const debugDefault: string = 'none';
    // const appsdirDefault: string = 'none';
    var packageJSON = JSON.parse(fs_1.default.readFileSync('package.json').toString());
    program.version(`Version = ${packageJSON.version}\nAuthor  = ${packageJSON.author}\nLicense = ${packageJSON.license}\nWebpage = ${packageJSON.repository.url}`)
        .name('nodedaemon')
        .option('-a, --appsdir <location...>', 'location of apps directory\n(default: if present the value from config.json appsDir otherwise ./apps')
        .option('-r, --replace', 'replace config file appsdir with command line appsdir - default is to merge them')
        .option('-c, --config <locaton>', 'name and location of config.json', './config.json')
        .option('-D --debug <type>', `logging level [${debugLevels.join(' | ')}]\n(default: if present the value from config.json debugLevel otherwise ${debugLevels[defaultDebug]})`)
        .parse(process.argv);
    let configFile = program.opts().config || './config.json';
    if (!fs_1.default.existsSync(configFile)) {
        defaultLogger = log4js_1.getLogger();
        defaultLogger.level = 'info';
        defaultLogger.fatal(`Config file ${configFile} not found`);
        process.exit(4);
    }
    try {
        var config = JSON.parse(fs_1.default.readFileSync(configFile).toString());
    }
    catch (err) {
        defaultLogger = log4js_1.getLogger();
        defaultLogger.level = 'info';
        defaultLogger.fatal(`Config file ${program.opts().config} is invalid: ${err}`);
        process.exit(4);
    }
    if (config.main.mqttlogger) {
        log4js_1.configure({
            appenders: {
                out: { type: 'stdout' },
                mqtt: {
                    type: 'common/mqttlogger',
                    host: config.main.mqttlogger.host,
                    clientid: config.main.mqttlogger.clientid,
                    username: config.main.mqttlogger.username,
                    password: config.main.mqttlogger.password
                }
            },
            categories: {
                default: { appenders: ['out', 'mqtt'], level: 'debug' }
            }
        });
    }
    defaultLogger = log4js_1.getLogger();
    if (!config.main.url) {
        defaultLogger.fatal(`Config file ${program.opts().config} is missing the url value`);
        process.exit(4);
    }
    if (!config.main.accessToken) {
        defaultLogger.fatal(`Config file ${program.opts().config} is missing the accessToken value`);
        process.exit(4);
    }
    if (config.main.debugLevel && !debugLevels.includes(config.main.debugLevel)) {
        defaultLogger.fatal(`Config file ${program.opts().config} has an invalid debugLevel value of ${config.main.debugLevel}`);
        process.exit(4);
    }
    if (program.opts().debug && !debugLevels.includes(program.opts().debug)) {
        defaultLogger.fatal(`Debug argument is invalid. Must be one of [${debugLevels.join(' | ')}]`);
        process.exit(4);
    }
    if (program.opts().debug) {
        config.main.debugLevel = program.opts().debug;
    }
    else if (!config.main.debugLevel) {
        config.main.debugLevel = debugLevels[defaultDebug];
    }
    if (!config.main.appsDir) {
        config.main.appsDir = [];
    }
    else if (!Array.isArray(config.main.appsDir)) {
        config.main.appsDir = [config.main.appsDir];
    }
    let cmdAppsDir = [];
    if (!program.opts().appsdir) {
        if (program.opts().replace) {
            defaultLogger.fatal('--appsdir is required when --replace is specified');
            process.exit(4);
        }
    }
    else {
        cmdAppsDir = program.opts().appsdir;
    }
    config.main.appsDir = program.opts().replace ? cmdAppsDir : config.main.appsDir.concat(cmdAppsDir);
    if (config.main.appsDir.length == 0) {
        config.main.appsDir.push('./apps');
    }
    config.main.appsDir = config.main.appsDir.map((item) => {
        if (typeof item != 'string') {
            defaultLogger.fatal(`appsDir ${item} is invalid`);
            process.exit(4);
        }
        return path_1.default.normalize((!path_1.default.isAbsolute(item)) ? path_1.default.join(process.cwd(), item) : item);
    });
    config.main.appsDir = Array.from(new Set(config.main.appsDir));
    config.main.appsDir.forEach((item, index) => {
        if (!fs_1.default.existsSync(item)) {
            config.main.appsDir[index] = null;
            defaultLogger.error(`Specified appsdir ${item} does not exist`);
        }
    });
    config.main.appsDir = config.main.appsDir.filter(item => item != null);
    if (config.main.appsDir.length == 0) {
        defaultLogger.fatal('No valid apps directories were found');
        process.exit(4);
    }
    if (!config.main.ignoreApps) {
        config.main.ignoreApps = [];
    }
    else if (!Array.isArray(config.main.ignoreApps)) {
        config.main.ignoreApps = [config.main.ignoreApps];
    }
    config.main.ignoreApps = config.main.ignoreApps.map((item) => {
        if (typeof item != 'string') {
            defaultLogger.fatal(`ignoreApps ${item} is invalid`);
            process.exit(4);
        }
        return path_1.default.normalize((!path_1.default.isAbsolute(item)) ? path_1.default.join(process.cwd(), item) : item);
    });
    defaultLogger.level = config.main.debugLevel;
    defaultLogger.info(`config file = ${configFile}`);
    defaultLogger.info(`apps directory = ${config.main.appsDir}`);
    defaultLogger.info(`Debug level = ${config.main.debugLevel}`);
}
catch (err) {
    if (!defaultLogger) {
        defaultLogger = log4js_1.getLogger();
        defaultLogger.level = 'info';
    }
    defaultLogger.fatal(`Unexpected error ${err}`);
    process.exit(4);
}
main(packageJSON.version, config);
//# sourceMappingURL=nodedaemon.js.map