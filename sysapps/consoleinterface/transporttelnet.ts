import { ConsoleInterface, ITransport } from ".";

import net from 'net';
import { ICommand } from "./ICommand";
var log4js = require('log4js');

const CATEGORY = 'TransportTelnet';
var logger = log4js.getLogger(CATEGORY);

class TransportTelnet implements ITransport {
    _name: string;
    _parent: ConsoleInterface;
    _host: string;
    _port: number;
    _commands: ICommand[];
    _server: net.Server;
    constructor(name: string, parent: ConsoleInterface, commands: ICommand[], config: any) {
        this._name = name;
        this._parent = parent;
        this._host = config?.telnet?.host || '0.0.0.0';
        this._port = config?.telnet?.port || 8821;
        this._commands = commands;
        this._server = null;
    }

    async _parseAndSend(stream: net.Socket, cmd: string): Promise<void> {

        let words: string[] = cmd.trim().split(' ');

        let command: ICommand = this._commands.find((entry) => entry.commandName == words[0].toLowerCase());

        if (!command) {
            stream.write(`Unknown command: ${words[0]}\r\n`);
        }
        else {
            command.execute(words, this._parent, stream);
        }
    }

    async start(): Promise<void> {
        this._server = net.createServer();
        this._server.on('connection', async (sock: net.Socket) => {
            sock.write(`\nConnected to ${this._name} - enter help for a list of commands\n\n`);
            sock.write(`${this._name} > `);
            logger.debug(`Socket connected ${sock.remoteAddress}`);
            sock.on('data', async (data: Buffer) => {
                if (data.toString() == 'exit\r\n') {
                    sock.write('Closing\n');
                    setTimeout(() => sock.end(), 500);
                }
                else {
                    await this._parseAndSend(sock, data.toString());
                    sock.write(`${this._name} $ `);
                }
            });
            sock.on('close', () => {
                logger.debug(`Socket ${sock.remoteAddress} closed`);
            });
        }).listen(this._port, this._host);
        logger.info(`Telnet server listening on port ${this._port}`);
    }

    async stop(): Promise<void> {
        return new Promise((resolve, _reject) => {
            this._server.close(() => resolve());
        });
    }
}

module.exports = TransportTelnet;
