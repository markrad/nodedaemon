import { getLogger, Logger } from 'log4js';
import * as schedule from 'node-schedule';
import { AppParent } from '../../common/appparent';
import { HaMain /*, SensorType */ } from '../../hamain';
import { Docker } from 'node-docker-api';
import DockerModem from 'docker-modem';
import { getTags } from '@snyk/docker-registry-v2-client';
import { readFileSync } from 'fs';
import { Container } from 'node-docker-api/lib/container';
import { HaGenericUpdateableItem } from '../../haitems/hagenericupdatableitem';
import { fileValidator, numberValidator, stringValidator, entityValidator } from '../../common/validator';
import { IHaItem } from '../../haitems/ihaitem';

const CATEGORY: string = 'ContainerVersionCheck';
var logger: Logger = getLogger(CATEGORY);

type Registry = {
    name: string;
    url: string;
    userId: string;
    password: string;
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

type ContainerWrapper = {
    container: Container;
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
    private readonly _re: RegExp = /^\d{1,4}\.\d{1,2}\.\d{1,2}$/;
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        
        try {
            if (!config.registries || !Array.isArray(config.registries)) {
                throw new Error('registries is a required entry and must be an array');
            }

            config.registries.forEach((registry: any) => {
                let name: string = stringValidator.isValid(registry.name, { name: 'registry' });
                stringValidator.isValid(registry.url, { name: registry.name });
                registry.userId = stringValidator.isValid(registry.userId, { noValueOk: true, defaultValue: null, name: registry.name });
                registry.password = stringValidator.isValid(registry.userId, { noValueOk: true, defaultValue: null, name: registry.name });
                this._registries[name] = { name: registry.name, url: registry.url, userId: registry.userId ?? null, password: registry.password ?? null };
            });

            if (!config.hosts || !Array.isArray(config.hosts)) {
                throw new Error('hosts is a required entry and must be an array');
            }

            config.hosts.forEach((host: any) => {
                stringValidator.isValid(host.host, { name: 'host' });
                host.port = numberValidator.isValid(host.port, { name: host.host, floatOk: false, minValue: 1024, maxValue: 49151, defaultValue: 2376 });
                if (!['http', 'https', 'ssh'].includes(host.protocol)) {
                    throw new Error(`${host.host} Invalid protocol`)
                }
                fileValidator.isValid(host.caFile);
                fileValidator.isValid(host.certFile);
                fileValidator.isValid(host.keyFile);
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
                    caFile: readFileSync(host.caFile, { encoding: 'utf8' }),
                    certFile: readFileSync(host.certFile, { encoding: 'utf8' }),
                    keyFile: readFileSync(host.keyFile, { encoding: 'utf8' }),
                    containers: containers,
                    names: containers.map((container) => container.name),
                });
            });
        }
        catch (e) {
            logger.error(e.message);
            return false;
        }

        return true;
    }

    async run(): Promise<boolean> {
        let updateFunc2: () => Promise<boolean> = async () => {
            return new Promise<boolean>(async (resolve, _reject) => {
                this._hosts.forEach(async (host) => {
                    try {
                        const dockerOptions: DockerModem.ConstructorOptions = {
                            ca: host.caFile,
                            cert: host.certFile,
                            key: host.keyFile,
                            host: host.host,
                            port: host.port,
                            protocol: host.protocol
                        };
                        const docker = new Docker(dockerOptions);
                        let containerList: ContainerWrapper[] = ((await docker.container.list())
                            .filter((value: Container) => host.names.includes(((value.data as any)['Image'] as string).split(':')[0])))
                            .map((value: Container) => ({ container: value, containerEntry: (host.containers.find((cont) => {
                                return cont.name == (value.data as any)['Image'].split(':')[0]; 
                            }) ) }))
                        for (let i = 0; i < containerList.length; i++) {
                            let repo: string = (containerList[i].container.data as any)['Image'].split(':');
                            try {
                                const initalValue: string = '';
                                let tags = (await getTags(containerList[i].containerEntry.registry.url, 
                                                            repo[0], 
                                                            containerList[i].containerEntry.registry.userId, 
                                                            containerList[i].containerEntry.registry.password))
                                    .filter((item: string) => this._re.exec(item))
                                    .sort((left: string, right: string) => {
                                        return left.split('.').reduce((previousValue: string, currentValue: string) => previousValue += currentValue.padStart(4, '0'), initalValue) <
                                                right.split('.').reduce((previousValue: string, currentValue: string) => previousValue += currentValue.padStart(4, '0'), initalValue) 
                                                ? 1
                                                : -1;
                                    });
                                logger.debug(`Image ${repo[0]}: Current ${repo[1]} Latest ${tags[0]}`);
                                containerList[i].containerEntry.currentEntity.updateState(repo[1], false);
                                containerList[i].containerEntry.dockerEntity.updateState(tags[0], false);
                            }
                            catch (err) {
                                logger.error(`Failed to retrieve tags for ${repo}: ${(err as Error).message}`)
                            }
                        }
                    }
                    catch (err) {
                        logger.error(`Failed to connect to docker: ${(err as Error).message}`)
                    }
                });
                resolve(true);
            });
        }
        
        const rule = new schedule.RecurrenceRule();
        rule.hour = [8, 20];
        this._job = schedule.scheduleJob(rule, updateFunc2);
        this.controller.on('serviceevent', async (eventType: string, data: any) => {
            if (eventType == 'nodedaemon' && data?.script == 'containerversioncheck' && data?.command == 'run') {
                logger.info('Update requested');
                await updateFunc2();
            }
        });
        return updateFunc2();
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            this._job.cancel();
            resolve();
        });
    }
}
