var fs = require('fs');
var log4js = require('log4js');
const { Command } = require('commander');
const path = require('path');

var HaMain = require('./hamain');

const CATEGORY = 'main';

async function main(version, config) {
    const LOGO = `
                                                  
             |         |                         
___  ___  ___| ___  ___| ___  ___  _ _  ___  ___ 
|   )|   )|   )|___)|   )|   )|___)| | )|   )|   )
|  / |__/ |__/ |__  |__/ |__/||__  |  / |__/ |  / 
                                                   Version ${version} is starting
`;
    var logger = log4js.getLogger(CATEGORY);
    logger.info(`${LOGO}`);

    try {
        var haMain = new HaMain(config);

        process.stdin.resume();
        ['SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM'].forEach((eventType) => {
            process.on(eventType, async (signal) => {
                logger.fatal(`Clean up after event ${signal}`);
                await haMain.stop();
                process.exit(eventType == 'SIGTERM'? 0 : 4);
            });
        });

        process.on('uncaughtException', (err) => {
            logger.error(`Unhandled error: ${err.message}\n${err.stack}`);
        })

        await haMain.start();
    }
    catch (err) {
        logger.error(`Error: ${err}`);
        logger.fatal(err.stack);
        process.exit(4);
    }
}

var defaultLogger; // = log4js.getLogger();

try {
    const program = new Command();

    const debugLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const defaultDebug = 3;
    const debugDefault = 'none';
    const appsdirDefault = 'none';

    var packageJSON = JSON.parse(fs.readFileSync('package.json'));

    program.version(`Version = ${packageJSON.version}\nAuthor  = ${packageJSON.author}\nLicense = ${packageJSON.license}\nWebpage = ${packageJSON.repository.url}`)
        .name('nodedaemon')
        .option('-a, --appsdir <location...>', 'location of apps directory\n(default: if present the value from config.json appsDir otherwise ./apps')
        .option('-r, --replace', 'replace config file appsdir with command line appsdir - default is to merge them')
        .option('-c, --config <locaton>', 'name and location of config.json', './config.json')
        .option('-D --debug <type>', `logging level [${debugLevels.join(' | ')}]\n(default: if present the value from config.json debugLevel otherwise ${debugLevels[defaultDebug]})`)
        .parse(process.argv);

    configFile = program.opts().config || './config.json';

    if (!fs.existsSync(configFile)) {
        defaultLogger = log4js.getLogger();
        defaultLogger.level = 'info';
        defaultLogger.fatal(`Config file ${configFile} not found`);
        process.exit(4);
    }

    try {
        var config = JSON.parse(fs.readFileSync(configFile));
    }
    catch (err) {
        defaultLogger = log4js.getLogger();
        defaultLogger.level = 'info';
        defaultLogger.fatal(`Config file ${program.opts().config} is invalid: ${err}`);
        process.exit(4);
    }

    if (config.main.mqttlogger) {
        log4js.configure({
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

    defaultLogger = log4js.getLogger();

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
        config.main.appsDir = [ config.main.appsDir ];
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

    config.main.appsDir = program.opts().replace? cmdAppsDir : config.main.appsDir.concat(cmdAppsDir);

    if (config.main.appsDir.length == 0) {
        config.main.appsDir.push('./apps');
    }

    config.main.appsDir = config.main.appsDir.map((item) => {
        if (typeof item != 'string') {
            defaultLogger.fatal(`appsDir ${item} is invalid`);
            process.exit(4);
        }
        return path.normalize((!path.isAbsolute(item))? path.join(process.cwd(), item) : item);
    });

    config.main.appsDir = Array.from(new Set(config.main.appsDir));

    config.main.appsDir.forEach((item, index) => {
        if (!fs.existsSync(item)) {
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
        config.main.ignoreApps = [ config.main.ignoreApps ];
    }

    config.main.ignoreApps = config.main.ignoreApps.map((item) => {
        if (typeof item != 'string') {
            defaultLogger.fatal(`ignoreApps ${item} is invalid`);
            process.exit(4);
        }
        return path.normalize((!path.isAbsolute(item))? path.join(process.cwd(), item) : item);
    });

    defaultLogger.level = config.main.debugLevel;
    defaultLogger.info(`config file = ${configFile}`);
    defaultLogger.info(`apps directory = ${config.main.appsDir}`);
    defaultLogger.info(`Debug level = ${config.main.debugLevel}`);
}
catch (err) {
    if (!defaultLogger) {
        defaultLogger = log4js.getLogger();
        defaultLogger.level = 'info';
    }
    defaultLogger.fatal(`Unexpected error ${err}`);
    process.exit(4);
}

main(packageJSON.version, config);