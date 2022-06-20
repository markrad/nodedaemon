import * as fs from 'fs';
import { getLogger, configure, Logger, Configuration } from 'log4js';
import { Command } from 'commander';
import Path from 'path';
import { HaMain } from './hamain';
import YAML, { ScalarTag } from 'yaml';
import { LogLevelValidator, LogLevels } from './common/loglevelvalidator';

const CATEGORY: string = 'main';

async function main(version: string, config: any, configPath: string) {
    const LOGO: string = `
                                                  
             |         |                         
___  ___  ___| ___  ___| ___  ___  _ _  ___  ___ 
|   )|   )|   )|___)|   )|   )|___)| | )|   )|   )
|  / |__/ |__/ |__  |__/ |__/||__  |  / |__/ |  / 
                                                   Version ${version} is starting
`;
    var logger: Logger = getLogger(CATEGORY);
    let level: any = (logger.level);

    if (level.level > 20000) {
        logger.level = 'info';
    }

    logger.info(`${LOGO}`);

    if (level.level > 20000) {
        logger.level = level.level;
    }

    try {
        var haMain: HaMain = new HaMain(config, configPath, version);

        process.stdin.resume();
        ['SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM'].forEach((eventType) => {
            process.on(eventType, async (signal) => {
                try {
                    logger.fatal(`Clean up after event ${signal}`);
                    await haMain.stop();
                    process.exit(eventType == 'SIGTERM'? 0 : 4);
                } 
                catch (err) {
                    logger.fatal(`Failed to close down cleanly: ${err.message}`);
                }
            });
        });

        process.on('uncaughtException', (err) => {
            logger.error(`Unhandled error: ${err.message}\n${err.stack}`);
            logger.debug(`Error content:\n${JSON.stringify(err, null, 4)}`);
        });

        process.on('warning', (e: any) => {
            let err: Error = e;
            logger.warn(`Node issued warning: ${err.message }\n${e.stack}`);
        });

        await haMain.start();
    }
    catch (err) {
        logger.error(`Error: ${err}`);
        logger.fatal(err.stack);
        process.exit(4);
    }
}

function fatalExit(message: string, returnCode: number, logger?: Logger) {
    let defaultLogger = logger? logger : getLogger();
    defaultLogger.level = 'info';
    defaultLogger.fatal(message);
    process.exit(returnCode);
}

var defaultLogger: Logger; 
let configFile: string = '';

const secret: ScalarTag = {
    identify: value => value instanceof String,
    default: false,
    tag: '!secret',
    resolve(str) {
        let data = fs.readFileSync(Path.join(configPath, 'secrets.yaml'), 'utf8');
        let vals = YAML.parse(data);
        return vals[str];
    },
}

try {
    const program = new Command();

    const defaultLogLevel: number = 3;

    var packageJSON: any = JSON.parse(fs.readFileSync('package.json').toString());

    program.version(`Version = ${packageJSON.version}\nAuthor  = ${packageJSON.author}\nLicense = ${packageJSON.license}\nWebpage = ${packageJSON.repository.url}`)
        .name('nodedaemon')
        .option('-a, --appsdir <location...>', 'location of apps directory\n(default: if present the value from config.yaml appsDir otherwise ./apps')
        .option('-r, --replace', 'replace config file appsdir with command line appsdir - default is to merge them')
        .option('-c, --config <locaton>', 'name and location of config.yaml', './config.yaml')
        .option('-l --loglevel <type>', `logging level [${LogLevels().join(' | ')}]\n(default: if present the value from config.yaml logLevel otherwise ${LogLevels()[defaultLogLevel]})`)
        .parse(process.argv);

    configFile = Path.resolve(program.opts().config ?? './config.yaml');

    if (!fs.existsSync(configFile)) {
        fatalExit(`Config file ${configFile} not found`, 4);
    }

    var config: any;
    var configPath = Path.dirname(configFile);

    try {
        config = YAML.parse(fs.readFileSync(configFile, 'utf8'),  { customTags: [secret] })
    }
    catch (err) {
        fatalExit(`Config file ${program.opts().config} is invalid: ${err}`, 4);
    }

    let loggerOptions: Configuration = {
        appenders: {
            out: { type: 'stdout' },
            emitter: {
                type: 'common/emitlogger'
            }
        },
        categories: {
            default: { appenders: ['out', 'emitter'], level: 'debug' }
        }
    }

    if (config.main.mqttlogger) {
        loggerOptions.appenders.mqtt = { 
            type: 'common/mqttlogger', 
            host: config.main.mqttlogger.host,
            clientid: config.main.mqttlogger.clientid,
            username: config.main.mqttlogger.username,
            password: config.main.mqttlogger.password
        }
        loggerOptions.categories.default.appenders = loggerOptions.categories.default.appenders.concat('mqtt');
    }

    configure(loggerOptions);

    defaultLogger = getLogger();

    if (!config.main.hostname) {
        fatalExit(`Config file ${program.opts().config} is missing the url value`, 4, defaultLogger);
    }

    if (!config.main.port) {
        config.main.port = 8123;
    }

    if (!config.main.accessToken) {
        fatalExit(`Config file ${program.opts().config} is missing the accessToken value`, 4, defaultLogger);
    }

    if (config.main.logLevel && !LogLevelValidator(config.main.logLevel)) {
        fatalExit(`Config file ${program.opts().config} has an invalid logLevel value of ${config.main.logLevel}`, 4, defaultLogger);
    }

    if (program.opts().logLevel && !LogLevelValidator(program.opts().debug)) {
        fatalExit(`Debug argument is invalid. Must be one of [${LogLevels().join(' | ')}]`, 4, defaultLogger);
    }

    if (program.opts().loglevel) {
        config.main.logLevel = program.opts().loglevel;
    }
    else if (!config.main.logLevel) {
        config.main.logLevel = LogLevels()[defaultLogLevel];
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
            fatalExit('--appsdir is required when --replace is specified', 4, defaultLogger);
        }
    }
    else {
        cmdAppsDir = program.opts().appsdir;
    }

    config.main.appsDir = program.opts().replace? cmdAppsDir : config.main.appsDir.concat(cmdAppsDir);

    if (config.main.appsDir.length == 0) {
        config.main.appsDir.push('./apps');
    }

    config.main.appsDir = config.main.appsDir.map((item: string) => {
        if (typeof item != 'string') {
            fatalExit(`appsDir ${item} is invalid`, 4, defaultLogger);
        }
        return Path.normalize((!Path.isAbsolute(item))? Path.join(process.cwd(), item) : item);
    });

    config.main.appsDir = Array.from(new Set(config.main.appsDir));

    config.main.appsDir.forEach((item: string, index: number) => {
        if (!fs.existsSync(item)) {
            config.main.appsDir[index] = null;
            defaultLogger.error(`Specified appsdir ${item} does not exist`);
        }
    });

    config.main.appsDir = config.main.appsDir.filter((item: string) => item != null);

    if (config.main.appsDir.length == 0) {
        fatalExit('No valid apps directories were found', 4, defaultLogger);
    }

    if (!config.main.ignoreApps) {
        config.main.ignoreApps = [];
    }
    else if (!Array.isArray(config.main.ignoreApps)) {
        config.main.ignoreApps = [ config.main.ignoreApps ];
    }

    config.main.ignoreApps = config.main.ignoreApps.map((item: string) => {
        if (typeof item != 'string') {
            fatalExit(`ignoreApps ${item} is invalid`, 4, defaultLogger);
        }
        return Path.normalize((!Path.isAbsolute(item))? Path.join(process.cwd(), item) : item);
    });

    defaultLogger.level = config.main.logLevel;
    defaultLogger.info(`config file = ${configFile}`);
    defaultLogger.info(`apps directory = ${config.main.appsDir}`);
    defaultLogger.info(`log level = ${config.main.logLevel}`);
}
catch (err) {
    fatalExit(`Unexpected error ${err}`, 4, defaultLogger);
}

main(packageJSON.version, config, configPath);