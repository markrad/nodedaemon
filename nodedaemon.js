var fs = require('fs');
var log4js = require('log4js');
const { Command } = require('commander');
const path = require('path');

var HaMain = require('./hamain');

const CATEGORY = 'main';

async function main(config) {
    var logger = log4js.getLogger(CATEGORY);
    const mainConfig = config.main;

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
    const debugDefault = 'none';
    const appsdirDefault = 'none';
    program.version('1.0.0')
        .name('nodedaemon')
        .option('-D --debug <type>', `Specify logging level [${debugLevels.join(' | ')}]`, debugDefault)
        .option('-c, --config <locaton>', 'Specify name and location of config.json', './config.json')
        .option('-a, --appsdir <location>', 'Location of apps directory', appsdirDefault)
        .parse(process.argv);

    defaultLogger.level = 'fatal';

    if (!fs.existsSync(program.opts().config)) {
        defaultLogger.fatal(`Config file ${program.opts().config} not found`);
        process.exit(4);
    }

    try {
        var config = JSON.parse(fs.readFileSync(program.opts().config));
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

    if (!debugLevels.concat(debugDefault).includes(program.opts().debug)) {
        defaultLogger.fatal(`Debug level is invalid. Must be one of [${debugLevels.join(' | ')}]`);
        process.exit(4);
    }

    if (program.opts().debug != debugDefault) {
        config.main.debug = program.opts().debug;
    }
    else if (!config.main.debug) {
        config.main.debug = 'info';
    }

    // if (!config.main.debugLevel || program.opts().debug != debugDefault) {
    //     config.main.debugLevel = program.opts().debug != debugDefault
    //         ? program.opts().debug
    //         : 'info';
    // }

    if (program.opts().appsdir != appsdirDefault) {
        config.main.appsDir = program.opts().appsDir;
    }
    else if (!config.main.appsDir) {
        config.main.appsDir = './apps';
    }

    if (!path.isAbsolute(config.main.appsDir)) {
        config.main.appsDir = path.join(process.cwd(), config.main.appsDir);
    }

    defaultLogger.level = config.main.debugLevel;
}
catch (err) {
    defaultLogger.fatal(`Unexpected error ${err}`);
    process.exit(4);
}

main(config);