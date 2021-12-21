import fs from 'fs';
import Path from 'path';
import { Server, Connection } from 'ssh2';
import { ParsedKey } from 'ssh2-streams';
import { utils } from 'ssh2';
import ConsoleInterface from ".";
import { ITransport } from './itransport';
import { TransportSSHClient } from './transportsshclient'
import { getLogger } from "log4js";
import { readFileSync } from 'fs';

let parseKey = utils.parseKey;

const CATEGORY: string = 'TransportSSH';
var logger = getLogger(CATEGORY);

export type User = {
    userid: Buffer;
    password: Buffer;
}

export class TransportSSH implements ITransport {
    static LOGO: string = `
                                                  
             |         |                         
___  ___  ___| ___  ___| ___  ___  _ _  ___  ___ 
|   )|   )|   )|___)|   )|   )|___)| | )|   )|   )
|  / |__/ |__/ |__  |__/ |__/||__  |  / |__/ |  / 
`;
    _name: string;
    _parent: ConsoleInterface;
    _host: string;
    _port: number;
    _users: User[] = [];
    _server: Server = null;
    _hostKey: Buffer;
    _allowedPubKeys: ParsedKey[] = [];
    _configRoot: string;
    public constructor(name: string, parent: ConsoleInterface, config: any) {
        this._name = name;
        this._parent = parent;
        this._host = config?.ssh.host || '0.0.0.0';
        this._port = config?.ssh.port || 8822;
        this._configRoot = parent.controller.configPath;

        if (!config?.ssh.users || typeof (config.ssh.users) != 'object' || Array.isArray(config.ssh.users) == false) {
            throw new Error('No userids were provided');
        }

        config.ssh.users.forEach((user: User) => {
            if (!user.userid || !user.password) {
                throw new Error('Incorrect format for userids');
            }
            this._users.push({ userid: Buffer.from(user.userid), password: Buffer.from(user.password) });
        });

        let key = config.ssh.keyFile;

        if (!Path.isAbsolute(key)) {
            key = Path.join(this._configRoot, key);
        }

        this._hostKey = fs.readFileSync(key);

        if (config.ssh.certFiles) {
            if (!Array.isArray(config.ssh.certFiles)) {
                throw new Error('Option certFiles must be an array');
            }

            config.ssh.certFiles.forEach((element: string) => {
                let work = Path.isAbsolute(element) ? element : Path.join(this._configRoot, element);
                let pkey: ParsedKey | ParsedKey[] | Error = parseKey(readFileSync(work));

                if (pkey instanceof Error) {
                    throw pkey;
                }

                this._allowedPubKeys = this._allowedPubKeys.concat(Array.isArray(pkey) ? pkey : [pkey]);
            });
        }
    }

    public async start(): Promise<void> {
        this._server = new Server({ hostKeys: [this._hostKey], banner: TransportSSH.LOGO }, (connection: Connection) => {
            logger.info('New client connected');
            let sshclient = new TransportSSHClient(connection);
            sshclient.start(this, this._parent);

        }).listen(this._port, this._host, () => {
            logger.info(`SSH server listening on port ${this._port}`);
        });
    }

    public async stop(): Promise<void> {
        return new Promise((resolve, _reject) => {
            this._server.close(() => resolve());
        });
    }

    public get Users(): User[] {
        return this._users;
    }

    public get AllowedPublicKeys(): ParsedKey[]
    {
        return this._allowedPubKeys;
    }
}
