import { getLogger, Logger } from 'log4js';
import * as schedule from 'node-schedule';
import { AppParent } from '../../common/appparent';
import { HaMain } from '../../hamain';
import { Docker } from 'node-docker-api';
import DockerModem from 'docker-modem';
import { getTags } from '@snyk/docker-registry-v2-client';
import { Container } from 'node-docker-api/lib/container';
import { HaGenericUpdateableItem } from '../../haitems/hagenericupdatableitem';
import { fileValidator, numberValidator, stringValidator, entityValidator } from '../../common/validator';
import { IHaItem } from '../../haitems/ihaitem';
import Path from 'path';
import https from 'https';
import { IncomingHttpHeaders } from 'http';

const CATEGORY: string = 'ContainerVersionCheck';
var logger: Logger = getLogger(CATEGORY);

type Registry = {
    name: string;
    url: string;
    userId: string;
    password: string;
    ca: string;
    tokenUrl: string,
    tokenEndpoint: string,
    tokenUserId: string,
    tokenPassword: string,
}

type RegistryType = {
    [id: string]: Registry;
}

type ContainerEntry = {
    name: string;
    currentEntity: IHaItem;
    dockerEntity: IHaItem;
    registry: Registry;
}

type LocalContainer = {
    name: string;
    version: string;
    found: boolean;
}

type ContainerWrapper = {
    container: LocalContainer;
    containerEntry: ContainerEntry;
}

type HostEntry = {
    host: string;
    port: number;
    protocol: 'http' | 'https' | 'ssh' | undefined;
    caFile: string;
    certFile: string;
    keyFile: string;
    containers: ContainerEntry[];
    names: string[];
}

export default class ContainerVersionCheck extends AppParent {
    private _registries: RegistryType = {};
    private _hosts: HostEntry[] = [];
    private _job: schedule.Job = null;
    private _configRoot: string;
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        this._configRoot = controller.configPath;
        logger.info('Constructed');
    }

    public async validate(config: any): Promise<boolean> {
        if (! await super.validate(config)) {
            return false;
        }
        try {
            if (!config.registries || !Array.isArray(config.registries)) {
                throw new Error('registries is a required entry and must be an array');
            }

            config.registries.forEach((registry: any) => {
                let name: string = stringValidator.isValid(registry.name, { name: 'registry' });
                stringValidator.isValid(registry.url, { name: registry.name });
                let userId = stringValidator.isValid(registry.userId, { noValueOk: true, defaultValue: null, name: registry.name });
                let password = stringValidator.isValid(registry.userId, { noValueOk: true, defaultValue: null, name: registry.name });
                let ca = fileValidator.isValid(registry.ca, { name: 'registry CA', noValueOk: true, returnContent: true });
                let tokenUrl = stringValidator.isValid(registry.tokenUrl, { noValueOk: true, defaultValue: null, name: registry.name });
                let tokenEndpoint = stringValidator.isValid(registry.tokenEndpoint, { noValueOk: true, defaultValue: null, name: registry.name });
                let tokenUserId = stringValidator.isValid(registry.tokenUserId, { noValueOk: true, defaultValue: null, name: registry.name });
                let tokenPassword = stringValidator.isValid(registry.tokenPassword, { noValueOk: true, defaultValue: null, name: registry.name });
                this._registries[name] = { 
                    name: registry.name, 
                    url: registry.url, 
                    userId: userId ?? null, 
                    password: password ?? null, 
                    ca: ca, 
                    tokenUrl: tokenUrl, 
                    tokenEndpoint: tokenEndpoint, 
                    tokenUserId: tokenUserId,
                    tokenPassword: tokenPassword };
            });

            if (!config.hosts || !Array.isArray(config.hosts)) {
                throw new Error('hosts is a required entry and must be an array');
            }

            config.hosts.forEach((host: any) => {
                stringValidator.isValid(host.host, { name: 'host' });
                host.port = numberValidator.isValid(host.port, { name: host.host, floatOk: false, minValue: 1024, maxValue: 49151, defaultValue: 2376 });
                if (!['http', 'https', 'ssh'].includes(host.protocol)) {
                    throw new Error(`${host.host} Invalid protocol: ${host.protocol}`);
                }
                let caFile: string = Path.isAbsolute(host.caFile) ? host.caFile : Path.join(this._configRoot, host.caFile);
                let certFile: string = Path.isAbsolute(host.certFile) ? host.certFile : Path.join(this._configRoot, host.certFile);
                let keyFile: string = Path.isAbsolute(host.keyFile) ? host.keyFile : Path.join(this._configRoot, host.keyFile);
                if (!host.containers || !Array.isArray(host.containers)) throw new Error(`${host.host} containers array is required`);
                let containers: ContainerEntry[] = [];
                host.containers.forEach((container: any) => {
                    stringValidator.isValid(container.container, { name: 'container' });
                    let currentEntity: HaGenericUpdateableItem = entityValidator.isValid(container.currentEntity, { entityType: HaGenericUpdateableItem, name: container.container });
                    let dockerEntity: HaGenericUpdateableItem = entityValidator.isValid(container.dockerEntity, { entityType: HaGenericUpdateableItem,  name: container.container });
                    let registry: string = stringValidator.isValid(container.registry, { name: container.container });
                    if (!this._registries[registry]) throw new Error(`${container.container} references an unknown registry`);
                    containers.push({ name: container.container, currentEntity: currentEntity, dockerEntity: dockerEntity, registry: this._registries[registry]});
                });
                this._hosts.push({ 
                    host: host.host, 
                    port: host.port, 
                    protocol: host.protocol, 
                    caFile: fileValidator.isValid(caFile, { returnContent: true }),
                    certFile: fileValidator.isValid(certFile, { returnContent: true }),
                    keyFile: fileValidator.isValid(keyFile, { returnContent: true }),
                    containers: containers,
                    names: containers.map((container) => container.name),
                });
            });
        }
        catch (e) {
            logger.error(e.message);
            return false;
        }

        logger.info('Validated successfully')
        return true;
    }

    async run(): Promise<boolean> {
        let updateFunc: () => Promise<boolean> = async () => {
            return new Promise<boolean>(async (resolve, _reject) => {
                for (let host of this._hosts) {
                    logger.debug(`Processing host ${host.host}`);
                    let containerList: ContainerWrapper[] = [];
                    try {
                        const dockerOptions: DockerModem.ConstructorOptions = {
                            ca: host.caFile,
                            cert: host.certFile,
                            key: host.keyFile,
                            host: host.host,
                            port: host.port,
                            protocol: host.protocol,
                        };
                        const docker = new Docker(dockerOptions);
                        containerList = ((await docker.container.list())
                            .map((entry: Container) => {
                                let parts: string[] = (entry.data as any)['Image'].split(':');
                                return { name: parts[0], version: parts[1] };
                            })
                            .filter((entry: LocalContainer) => {
                                return host.names.includes(entry.name);
                            })
                            .map((entry: LocalContainer) => {
                                return { container: entry, containerEntry: host.containers.find((hostentry: ContainerEntry) => {
                                    return entry.name == hostentry.name;
                                }) }
                            })
                        );
                    }
                    catch (err) {
                        logger.error(`Failed to retrieve local containers from ${host.host}: ${err}`);
                    }
                    try {
                        for (let cwValue of containerList) {
                            let repo: string = cwValue.container.name.includes('/')
                                ? cwValue.container.name
                                : 'library/' + cwValue.container.name;
                            if (repo.startsWith(cwValue.containerEntry.registry.url)) {
                                repo = repo.substring(cwValue.containerEntry.registry.url.length + 1);
                            }
                            try {
                                let token = null;
                                logger.debug(`Registry: ${cwValue.containerEntry.registry.url} Repo: ${repo}`)
                                let tagOptions: { ca?: string, headers?: any } = {};
                                if (cwValue.containerEntry.registry.ca) tagOptions.ca = cwValue.containerEntry.registry.ca;
                                if (cwValue.containerEntry.registry.tokenUrl != null) {
                                    token = await ContainerVersionCheck._getToken(
                                        Path.join(cwValue.containerEntry.registry.tokenUrl, cwValue.containerEntry.registry.tokenEndpoint),
                                        cwValue.containerEntry.registry.tokenUserId,
                                        cwValue.containerEntry.registry.tokenPassword);
                                        tagOptions.headers = { Authorization: token }; 
                                }
                                let highTag = await ContainerVersionCheck._getHighTag(await getTags(cwValue.containerEntry.registry.url, 
                                    repo, 
                                    cwValue.containerEntry.registry.userId, 
                                    cwValue.containerEntry.registry.password,
                                    undefined, 
                                    undefined,
                                    tagOptions), cwValue.container.version);
                                let updated: string = cwValue.container.version == highTag? '' : ' - update available';
                                logger.info(`Image ${cwValue.container.name}: Current ${cwValue.container.version} Latest ${highTag}${updated}`);
                                cwValue.containerEntry.currentEntity.updateState(cwValue.container.version, false);
                                cwValue.containerEntry.dockerEntity.updateState(highTag, false);
                            }
                            catch (err) {
                                logger.error(`Failed to retrieve tags for ${repo}: ${(err as Error).message}`)
                            }
                        }
                    }
                    catch (err) {
                        logger.error(`Failed to connect to docker: ${(err as Error).message}`)
                    }
                }
                resolve(true);
            });
        }
        
        const rule = new schedule.RecurrenceRule();
        rule.hour = [8, 20];
        rule.minute = 0;
        this._job = schedule.scheduleJob(rule, updateFunc);
        this.controller.on('serviceevent', async (eventType: string, data: any) => {
            if (eventType == 'nodedaemon' && data?.script == 'containerversioncheck' && data?.command == 'run') {
                logger.info('Update requested');
                await updateFunc();
            }
        });
        return updateFunc();
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            this._job.cancel();
            this._hosts = [];
            resolve();
        });
    }

    private static async _httpGet(url: string, options: object): Promise<[ IncomingHttpHeaders, string ]> {
        return new Promise<[ IncomingHttpHeaders, string ]>((resolve, reject) => {
            logger.debug(`Getting ${url}`)
            https.get(url, options, (res) => {
                if (res.statusCode != 200) {
                    reject(new Error(`HTTP request failed with status ${res.statusCode}`));
                }
                else {
                    let body = '';
            
                    res.on('data', (d) => body += d);
                    res.on('end', () => resolve([ res.headers, body ]));
                    res.on('error', (err) => reject(err));
                }
            
            });
        })
    }
    
    private static async _getToken(url: string, userId: string, password: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            let options = {
                auth: `${userId}:${password}`
            };
    
            try {
                let [_headers, body] = await ContainerVersionCheck._httpGet(url, options);
                resolve(`Bearer ${JSON.parse(body).token}`);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    private static async _getHighTag(tags: string[], currentVersion: string): Promise<string> {
        let [ front, back ] = currentVersion.replace(/\d+\.\d+\.\d+/, '\n').split('\n');
        const regex = new RegExp(`^${front}\\d+\\.\\d+\\.\\d+${back}$`);
        let highTag = tags.filter((t) => regex.test(t))
            .map((t) => ({ version: t, work: parseInt(t.slice(0, t.length - back.length).slice(front.length).split('.')
            .map((p) => p.padStart(4, '0')).join('')) }))
            .reduce((l, r) => l.work > r.work? l : r, { version: '0.0.0', work: 0 }).version;
        
        return highTag;
    }
}
