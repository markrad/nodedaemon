var fs = require('fs');
var log4js = require('log4js');
const { Command } = require('commander');

var HaMain = require('./hamain');

const CATEGORY = 'main';

async function main(config) {
    var logger = log4js.getLogger(CATEGORY);
    const mainConfig = config.main;

    logger.info('HaRunner is starting');

    try {
        var haMain = new HaMain(config);

        await haMain.start();
        //await haMain.stop();
    }
    catch (err) {
        logger.error(`Error: ${err}`);
        logger.fatal(err.stack);
    }
}

var defaultLogger = log4js.getLogger();

try {
    const program = new Command();

    const debugLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const debugDefault = 'use value from config.json or info';

    program.version('1.0.0')
        .name('nodedaemon')
        .option('-D --debug <type>', `Specify logging level [${debugLevels.join(' | ')}]`, debugDefault)
        .option('-c, --config <locaton>', 'Specify name and location of config.json', './config.json')
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

    if (!config.main.debugLevel || program.opts().debug != debugDefault) {
        config.main.debugLevel = program.opts().debug != debugDefault
            ? program.opts().debug
            : 'info';
    }

    defaultLogger.level = config.main.debugLevel;
}
catch (err) {
    defaultLogger.fatal(`Unexpected error ${err}`);
    process.exit(4);
}

main(config);