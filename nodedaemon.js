var fs = require('fs');
var log4js = require('log4js');
const { Command } = require('commander');
const path = require('path');

var HaMain = require('./hamain');

const CATEGORY = 'main';

async function main(config) {
    var logger = log4js.getLogger(CATEGORY);

    logger.info('HaRunner is starting');

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

var defaultLogger = log4js.getLogger();

try {
    const program = new Command();

    const debugLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const defaultDebug = 3;
    const debugDefault = 'none';
    const appsdirDefault = 'none';

    var packageJSON = JSON.parse(fs.readFileSync('package.json'));

    program.version(`Version = ${packageJSON.version}\nAuthor  = ${packageJSON.author}\nLicense = ${packageJSON.license}\nWebpage = ${packageJSON.repository.url}`)
        .name('nodedaemon')
        .option('-a, --appsdir <location>', 'location of apps directory\n(default: if present the value from config.json appsDir otherwise ./apps')
        .option('-c, --config <locaton>', 'name and location of config.json', './config.json')
        .option('-D --debug <type>', `logging level [${debugLevels.join(' | ')}]\n(default: if present the value from config.json debugLevel otherwise ${debugLevels[defaultDebug]})`)
        .parse(process.argv);

    defaultLogger.level = 'fatal';

    configFile = program.opts().config || './config.json';

    if (!fs.existsSync(configFile)) {
        defaultLogger.fatal(`Config file ${configFile} not found`);
        process.exit(4);
    }

    try {
        var config = JSON.parse(fs.readFileSync(configFile));
    }
    catch (err) {
        defaultLogger.fatal(`Config file ${program.opts().config} is invalid: ${err}`);
        process.exit(4);
    }

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

    if (program.opts().appsdir) {
        config.main.appsDir = program.opts().appsdir;
    }
    else if (!config.main.appsDir) {
        config.main.appsDir = './apps';
    }

    if (!path.isAbsolute(config.main.appsDir)) {
        config.main.appsDir = path.join(process.cwd(), config.main.appsDir);
    }

    if (!fs.existsSync(config.main.appsDir)) {
        defaultLogger.fatal(`Apps directory ${config.main.appsDir} does not exist`);
        process.exit(4);
    }

    defaultLogger.level = config.main.debugLevel;
    defaultLogger.info(`config file = ${configFile}`);
    defaultLogger.info(`apps directory = ${config.main.appsDir}`);
    defaultLogger.info(`Debug level = ${config.main.debugLevel}`);
}
catch (err) {
    defaultLogger.fatal(`Unexpected error ${err}`);
    process.exit(4);
}

main(config);