import { getLogger } from 'log4js';
import { IOutPacket } from "./IOutPacket";
import { IServicePong } from "./IServicePong";
import { IServiceSuccess } from "./IServiceSuccess";
import { IServiceError } from "./IServiceError";

type Message = {
    resolve: (response: IServiceSuccess | IServicePong | IServiceError) => void,
    reject: (err: Error) => void,
    packet: IOutPacket,
    timeAdded?: number,
}

const CATEGORY = 'PacketTracker';

var logger = getLogger(CATEGORY);

export class PacketTracker {
    private _inflight: Map<number, Message> = new Map<number, Message>();
    private _hInterval: NodeJS.Timer = null;
    constructor() {
        this._hInterval = setInterval(() => {
            let now = Number(new Date()) / 1000;
            for (const [ key, value ] of this._inflight) {
                if (now - value.timeAdded > 120) {
                    logger.debug(`Dropping ${key}`);
                    let err = new Error(`No reponse received for packet ${key}: ${JSON.stringify(value)}`);
                    value.reject(err);
                    this._inflight.delete(key);
                }
            }
        });
    }
    addInFlight(key: number, message: Message): void {
        logger.trace(`Adding ${key}: ${JSON.stringify(message)}`)
        message.timeAdded = Number(new Date());
        this._inflight.set(key, message);
    }
    deliverResponse(key: number, response: IServiceSuccess | IServicePong | IServiceError): void {
        let message = this._inflight.get(key);

        this._inflight.delete(key);

        if (!message) {
            logger.warn(`No inflight for ${key} - likely timed out`);
        }
        else {
            logger.trace(`Completing ${key}: ${JSON.stringify(response)}`)
            if (response.type == 'result' || response.type == 'pong') {
                message.resolve(response);
            }
            else {
                message.reject(new Error(`Bad response: ${JSON.stringify(message)}`));
            }
        }
    }
    cleanup() {
        clearInterval(this._hInterval);
    }
}