"use strict"
import { Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
// import { IHaItemEditable, SafeItemAssign } from '../../haitems/haparentitem';
import { HaMain } from '../../hamain';

const CATEGORY = 'AqaraSwitch';

const logger: Logger = require('log4js').getLogger(CATEGORY);

interface ISwitchInfo {
    id: string;
    index: number;
}

export default class AqaraSwitch extends AppParent {
    private _controller: HaMain = null;
    private _groups: Group[] = [];
    constructor(controller: HaMain) {
        super(logger);
        this._controller = controller;
        logger.info('Constructed');
    }
    validate(config: any): boolean {
        const regex = /^[a-fA-F0-9]{2}(:[a-fA-F0-9]{2}){7}$/;
        try {
            if (!Array.isArray(config)) {
                throw new Error('Config must be an array');
            }
            config.forEach((item) => {
                if (!Array.isArray(item)) {
                    throw new Error('All entries in the outer array must also be arrays');
                }
                let entities: HaGenericSwitchItem[] = [];
                let switches: ISwitchInfo[] = [];
                item.forEach((subitem) => {
                    var e: HaGenericSwitchItem;
                    if (!('entity' in subitem)) {
                        throw new Error('All objects in inner arrays must have an entity item');
                    }

                    let target: string = subitem.entity;

                    // TODO Find some mechanism to see if the entity is derived from HaItemGenericSwitch
                    if (!target.startsWith('light.') && !target.startsWith('switch.')) {
                        throw new Error(`Entity ${subitem.entity} is not a light or switch`);
                    }   

                    if (null == (e = (this._controller.items.getItem(subitem.entity)) as HaGenericSwitchItem)) {
                        throw new Error(`Entity ${subitem.entity} does not exist`);
                    }

                    if ('switch' in subitem) {
                        if (null == regex.exec(subitem.switch)) {
                            throw new Error(`Switch value ${subitem.switch} is invalid`);
                        }
                        if (null != switches.find((switchEntry) => { switchEntry == subitem.switch  })) {
                            throw new Error(`Switch ${subitem.switch} appears twice - not supported`);
                        }
                        switches.push({ id: (subitem.switch as string), index: entities.length });
                    }
                    entities.push(e);
                });

                if (switches.length == 0) {
                    throw new Error('A group must have at least one entity that includes a switch value');
                }
                this._groups.push(new Group(switches, entities));
            });
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }
        
        logger.info('Validated successfully');
        return true;
    }
    run(): Promise<boolean> {
        return new Promise<boolean>((resolve, _reject) => {
            this._controller.on('serviceevent', this._eventHandler);
            resolve(true);
        });
    }
    stop(): Promise<void> {
        return new Promise<void>((resolve, _reject) => {
            this._controller.off('serviceevent', this._eventHandler);
            resolve();
        });
    }

    _eventHandler = (eventName: string, eventData: any) => {
        if (eventName == "deconz_event") {
            for (let i = 0; i < this._groups.length; i++) {
                if (eventData.event == '1002') {
                    if (this._groups[i].singleAction(eventData.unique_id)) {
                        break;
                    }
                }
                else if (eventData.event == '1004') {
                    if (this._groups[i].multiAction(eventData.unique_id)) {
                        break;
                    }
                }
            }
        }
    }
}

class Group {
    private _switches: ISwitchInfo[];
    private _entities: HaGenericSwitchItem[];
    constructor(switches: ISwitchInfo[], entities: HaGenericSwitchItem[]) {
        this._switches = switches;
        this._entities = entities;
    }

    get entities(): HaGenericSwitchItem[] {
        return this._entities;
    }

    singleAction(switchId: string): boolean {
        let entry: ISwitchInfo = this._switches.find((entry) => entry.id == switchId);

        if (entry == null) return false;

        this._entities[entry.index].toggle();

        return true;
    }

    multiAction(switchId: string): boolean {
        let entry: ISwitchInfo = this._switches.find((entry) => entry.id == switchId);

        if (entry == null) return false;

        let sameState: boolean = true;
        let firstState: boolean = this._entities[0].isOn;

        for (let i = 1; i < this._entities.length; i++) {
            if (firstState != this._entities[i].isOn) {
                sameState = false;
                break;
            }
        }

        let newState = sameState? !this._entities[entry.index].isOn : this._entities[entry.index].isOn;

        this._entities.forEach((entity) => entity.updateState(newState));
        return true;
    }
}
