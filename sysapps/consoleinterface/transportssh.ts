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
    _name: string;
    _parent: ConsoleInterface;
    _host: string;
    _port: number;
    _users: User[] = [];
    _server: Server = null;
    _hostKey: Buffer;
    _allowedPubKeys: ParsedKey[] = [];
    _configRoot: string;
    _clients: TransportSSHClient[] = [];
    public constructor(name: string, parent: ConsoleInterface, config: any) {
        this._name = name;
        this._parent = parent;
        this._host = config?.host || '0.0.0.0';
        this._port = config?.port || 8822;
        this._configRoot = parent.controller.configPath;

        if (!config?.users || typeof (config.users) != 'object' || Array.isArray(config.users) == false) {
            throw new Error('No userids were provided');
        }

        config.users.forEach((user: User) => {
            if (!user.userid || !user.password) {
                throw new Error('Incorrect format for userids');
            }
            this._users.push({ userid: Buffer.from(user.userid), password: Buffer.from(user.password) });
        });

        let key = config.keyFile;

        if (!Path.isAbsolute(key)) {
            key = Path.join(this._configRoot, key);
        }

        this._hostKey = fs.readFileSync(key);

        if (config.certFiles) {
            if (!Array.isArray(config.certFiles)) {
                throw new Error('Option certFiles must be an array');
            }

            config.certFiles.forEach((element: string) => {
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
        this._server = new Server({ hostKeys: [this._hostKey] }, (connection: Connection) => {
            logger.info('New client connected');
            this._addClient(new TransportSSHClient(connection).start(this, this._parent)
                .on('end', (client: TransportSSHClient) =>  { 
                    this._removeClient(client);
                })
            );
        }).listen(this._port, this._host, () => {
            logger.info(`SSH server listening on port ${this._port}`);
        });
    }

    public async stop(): Promise<void> {
        return new Promise((resolve, _reject) => {
            this._clients.forEach((client) => client.kill());
            this._server.close(() => resolve());
            logger.info('Transport stopped');
            resolve();
        });
    }

    public get Users(): User[] {
        return this._users;
    }

    public get AllowedPublicKeys(): ParsedKey[]
    {
        return this._allowedPubKeys;
    }

    private _addClient(client: TransportSSHClient): void {
        this._clients.push(client);
    }

    private _removeClient(client: TransportSSHClient): void {
        this._clients = this._clients.filter((c) => c != client);
    }
}
