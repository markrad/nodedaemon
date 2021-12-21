"use strict";

import ConsoleInterface from ".";
import { IChannel } from "./ichannel";
import { CommandBase } from './commandbase'; 

export class CommandHa extends CommandBase {
    public constructor() {
        super('ha', ['restart', 'stop', 'status']);
    }

    public get helpText(): string {
        return `${this.commandName} \tstatus\t\t\tGet Home Assistant Status\r\n\trestart\t\t\tRestart Home Assistant\r\n\tstop\t\t\tStop Home Assistant`;
    }

    public async execute(inputArray: string[], that: ConsoleInterface, sock: IChannel): Promise<void> {
        try {
            this._validateParameters(inputArray);

            if (inputArray.length != 2) {
                throw new Error(`Too many parameters passed for ${inputArray[1]}`)
            }

            switch (inputArray[1]) {
                case 'restart':
                    sock.write('Restarting Home Assistant\r\n');
                    that.controller.restartHA();
                break;
                case 'stop':
                    sock.write('Stopping Home Assistant\r\n');
                    that.controller.stopHA();
                break;
                case 'status':
                    sock.write(`${that.controller.isConnected? 'Connected' : 'Not connected'} to Home Assistant\r\n`);
                break;
                default:
                    throw new Error('Parameter validation error - this should not happen');
            }
        }
        catch (err: any) {
            sock.write(`${err}\r\n`);
            sock.write('Usage:\r\n');
            sock.write(this.helpText);
            sock.write('\r\n');
        }
    }
}
