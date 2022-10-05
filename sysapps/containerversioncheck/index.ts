import { getLogger, Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaMain /*, SensorType */ } from '../../hamain';
import { Docker } from 'node-docker-api';
import DockerModem from 'docker-modem';
import { getTags } from '@snyk/docker-registry-v2-client';
import fs from 'fs';
import { Container } from 'node-docker-api/lib/container';
import { HaGenericUpdateableItem } from '../../haitems/hagenericupdatableitem';
// import { HaItemSensor } from '../../haitems/haitemsensor'
// import { IHaItemEditable } from '../../haitems/haparentitem';
// import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
// import { resolve } from 'path';
// import { HaItemUpdate } from '../../haitems/haitemupdate';

const CATEGORY: string = 'ContainerVersionCheck';
var logger: Logger = getLogger(CATEGORY);

type ContainerPair = {
    name: string;
    entity: HaGenericUpdateableItem;
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
        this._containerPairs;
        try {
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

            config.containers.forEach((item: any) => {
                if (!item.container) {
                    throw new Error('container value missing from containers list');
                }
                if (!item.entity){
                    throw new Error('entity value missing from containers list');
                }
                this._containerPairs.push({ name: item.container, entity: null });
                // this._containerPairs.push({ name: item.container, entity: this.controller.items.getItemAs<HaGenericUpdateableItem>(HaGenericUpdateableItem, item.entity, true) });
            });
        }
        catch (err: any) {
            logger.error((err as Error).message);
            return false;
        }

        return true;
    }

    async run(): Promise<boolean> {
        let ca: Buffer = !this._caFile? undefined : fs.readFileSync(this._caFile);
        let cert: Buffer = !this._certFile? undefined : fs.readFileSync(this._certFile);
        let key: Buffer = !this._keyFile? undefined : fs.readFileSync(this._keyFile);
        let re: RegExp = /^\d{1,4}\.\d{1,2}\.\d{1,2}$/;
        let names: string[] = this._containerPairs.map((item: ContainerPair) => item.name);
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const dockerOptions: DockerModem.ConstructorOptions = {
                    ca: ca,
                    cert: cert,
                    key: key,
                    host: 'rr-hass.lan',
                    port: this._port,
                    protocol: this._protocol as 'http'
                };
                const docker = new Docker(dockerOptions);
                let containerList = ((await docker.container.list())
                    .filter((value: Container) => names.includes(((value.data as any)['Image'] as string).split(':')[0].split('/')[0])));

                for (let i = 0; i < containerList.length; i++) {
                    let repo: string = (containerList[i].data as any)['Image'].split(':');
                    try {
                        let tags = (await getTags(this._dockerURL, repo[0], this._dockerUserId, this._dockerPassword))
                            .filter((item: string) => re.exec(item));
                        // logger.debug(tags);
                        logger.debug(`Image ${repo[0]}: Current ${repo[1]} Latest ${tags.slice(-1)[0]}`);
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

    async stop(): Promise<void> {
        return new Promise(async (resolve, _reject) => {
            resolve();
        });
    }
}
