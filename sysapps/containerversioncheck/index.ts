import { getLogger, Logger } from 'log4js';
import * as schedule from 'node-schedule';
import { AppParent } from '../../common/appparent';
import { HaMain /*, SensorType */ } from '../../hamain';
import { Docker } from 'node-docker-api';
import DockerModem from 'docker-modem';
import { getTags } from '@snyk/docker-registry-v2-client';
import fs from 'fs';
import { Container } from 'node-docker-api/lib/container';
import { HaGenericUpdateableItem } from '../../haitems/hagenericupdatableitem';

const CATEGORY: string = 'ContainerVersionCheck';
var logger: Logger = getLogger(CATEGORY);

type ContainerPair = {
    name: string;
    currentEntity: HaGenericUpdateableItem;
    dockerEntity: HaGenericUpdateableItem;
}

export default class ContainerVersionCheck extends AppParent {
    private _protocol: string = null;
    private _socketPath: string = null;
    private _caFile: string = null;
    private _certFile: string = null;
    private _keyFile: string = null;
    private _port: number = null;
    private _containerPairs: ContainerPair[] = [];
    private _dockerUserId: string = null;
    private _dockerPassword: string = null;
    private _dockerURL: string = 'registry.hub.docker.com';
    private _ca: Buffer = null;
    private _cert: Buffer = null;
    private _key: Buffer = null;
    private _names: string[] = [];
    private _job: schedule.Job = null;
    private readonly _re: RegExp = /^\d{1,4}\.\d{1,2}\.\d{1,2}$/;
    constructor(controller: HaMain, _config: any) {
        super(controller, logger);
        logger.info('Constructed');
    }

    validate(config: any): boolean {
        
        this._protocol = config.protocol ?? null;
        this._socketPath = config.socketPath ?? null;
        this._caFile = config.caFile ?? null;
        this._certFile = config.certFile ?? null;
        this._keyFile = config.keyFile ?? null;
        this._port = !config.port? null : parseInt(config.port);
        this._dockerUserId = config.dockerUserId ?? null;
        this._dockerPassword = config.dockerPassword ?? null;
        if (config.dockerURL) this._dockerURL = config.dockerURL;
        try {
            if (undefined != [this._caFile, this._certFile, this._keyFile].find((item: string) => item == null)) {
                throw new Error('caFile, certFile and keyFile must all be specified or non');
            }
            if (!['http', 'https', 'ssh'].includes(this._protocol)) {
                throw new Error('Invalid protocol')
            }

            if (this._socketPath == null) {
                throw new Error('socketPath is required');
            }

            if (this._port == NaN) {
                throw new Error('port is invalid');
            }

            if (!Array.isArray(config.containers)) {
                throw new Error('Expected array of containers and entities');
            }

            if (config.containers.length == 0) {
                throw new Error('No container specified to test');
            }

            config.containers.forEach((item: any) => {
                if (!item.container) {
                    throw new Error('container value missing from containers list');
                }
                if (!item.currentEntity){
                    throw new Error('currentEntity value missing from containers list');
                }
                if (!item.dockerEntity){
                    throw new Error('dockerEntity value missing from containers list');
                }
                // this._containerPairs.push({ name: item.container, entity: null });
                this._containerPairs.push({ name: item.container, 
                    currentEntity: this.controller.items.getItemAsEx(item.currentEntity, HaGenericUpdateableItem, true),
                    dockerEntity: this.controller.items.getItemAsEx(item.dockerEntity, HaGenericUpdateableItem, true) });
            });
            this._ca = !this._caFile? undefined : fs.readFileSync(this._caFile);
            this._cert = !this._certFile? undefined : fs.readFileSync(this._certFile);
            this._key = !this._keyFile? undefined : fs.readFileSync(this._keyFile);
            this._names = this._containerPairs.map((item: ContainerPair) => item.name);
        }
        catch (err: any) {
            logger.error((err as Error).message);
            return false;
        }

        return true;
    }

    async run(): Promise<boolean> {
        let updateFunc: () => Promise<boolean> = async () => {
            return new Promise<boolean>(async (resolve, reject) => {
                try {
                    const dockerOptions: DockerModem.ConstructorOptions = {
                        ca: this._ca,
                        cert: this._cert,
                        key: this._key,
                        host: 'rr-hass.lan',
                        port: this._port,
                        protocol: this._protocol as 'http'
                    };
                    const docker = new Docker(dockerOptions);
                    let containerList = ((await docker.container.list())
                        .filter((value: Container) => this._names.includes(((value.data as any)['Image'] as string).split(':')[0].split('/')[0])));
    
                    for (let i = 0; i < containerList.length; i++) {
                        let repo: string = (containerList[i].data as any)['Image'].split(':');
                        try {
                            const initalValue: string = '';
                            let tags = (await getTags(this._dockerURL, repo[0], this._dockerUserId, this._dockerPassword))
                                .filter((item: string) => this._re.exec(item))
                                .sort((left: string, right: string) => {
                                    return left.split('.').reduce((previousValue: string, currentValue: string) => previousValue += currentValue.padStart(4, '0'), initalValue) <
                                           right.split('.').reduce((previousValue: string, currentValue: string) => previousValue += currentValue.padStart(4, '0'), initalValue) 
                                           ? 1
                                           : -1;
                                });
                            logger.debug(`Image ${repo[0]}: Current ${repo[1]} Latest ${tags[0]}`);
                            let cp: ContainerPair = this._containerPairs.find((item) => item.name == repo[0].split('/')[0]);
                            cp.currentEntity.updateState(repo[1]);
                            cp.dockerEntity.updateState(tags[0]);
                        }
                        catch (err) {
                            logger.error(`Failed to retrieve tags for ${repo}: ${(err as Error).message}`)
                        }
                    }
                    resolve(true);
                }
                catch (err: any) {
                    logger.error(`Failed to connect to docker: ${(err as Error).message}`)
                    reject(false);
                }
            });
        }
        
        const rule = new schedule.RecurrenceRule();
        rule.hour = [8, 20];
        this._job = schedule.scheduleJob(rule, updateFunc);
        return updateFunc();
    }

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            this._job.cancel();
            resolve();
        });
    }
}
