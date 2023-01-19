import { IHaItemEditable } from './ihaitemeditable';
import { ServicePromise } from './haparentitem';


export interface IHaItemSwitch extends IHaItemEditable {
    turnOn: () => Promise<ServicePromise>;
    turnOff: () => Promise<ServicePromise>;
    toggle: () => Promise<ServicePromise>;
    turnOffAt: (moment: number) => Promise<void>;
    get isOn(): boolean;
    get isOff(): boolean;
    get timeBeforeOff(): number;
    get isTimerRunning(): boolean;
}
