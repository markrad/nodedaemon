"use strict"
import { Logger } from 'log4js';
import { AppParent } from '../../common/appparent';
import { HaGenericSwitchItem } from '../../haitems/hagenericswitchitem';
import { HaMain } from '../../hamain';
import { State } from '../../hamain/state';
import HaItemMediaPlayer from '../../haitems/haitemmedia_player';
import HaItemCalendar from '../../haitems/haitemcalendar';
import { entityValidator } from '../../common/validator';

const CATEGORY = 'TrashTalk';

const logger: Logger = require('log4js').getLogger(CATEGORY);

export default class TrashTalk extends AppParent {
    private _calEntity: HaItemCalendar = null;
    private _getTrash: HaGenericSwitchItem = null;
    constructor(controller: HaMain) {
        super(controller, logger);
        logger.info('Constructed');
    }

    public validate(config: any): boolean {
        if (!super.validate(config)) {
            return false;
        }
        try {
            this._calEntity = entityValidator.isValid(config.calendar, { entityType: HaItemCalendar, name: 'Trash Calendar' });
            this._getTrash = entityValidator.isValid(config.trashFlag, { entityType: HaGenericSwitchItem, name: 'Trash Flag' });
        }
        catch (err) {
            logger.error(err.message);
            return false;
        }
        return true;
    }

    public async run(): Promise<boolean> {
        const monthNames: string[] = [
            "January", 
            "February", 
            "March", 
            "April", 
            "May", 
            "June",
            "July", 
            "August", 
            "September", 
            "October", 
            "November", 
            "December"
        ];        
        const dayNames: string[] = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        ];
        return new Promise(async (resolve, _reject) => {
            await this._getTrash.turnOff();
            this._getTrash.on('new_state', async (that: HaGenericSwitchItem, _oldState: State) => {
                try {
                    if (that.state == 'on') {
                        await that.turnOff();
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        let alexa: HaItemMediaPlayer = this._getLastAlexa();
                        let day = new Date(this._calEntity.startTime);
                        let desc = this._calEntity.description;
                        let dayStr = `${dayNames[day.getDay()]}, ${monthNames[day.getMonth()]} ${day.getDate()}`;
                        let msg = `Trash will be collected on ${dayStr} and will${desc.indexOf('recycle')? ' ' : ' not '}include recycling`;
                        logger.debug(msg);
                        this.emit('callservice', 'notify', 'alexa_media_' + alexa.name, { message: msg, data: { type: 'tts' } });
                    }
                }
                catch (err) {
                    logger.error(err.message);
                }
            });
            resolve(true);
        });
    }

    public async stop() {}

    private _getLastAlexa(): HaItemMediaPlayer {
        return (this.controller.items.getItemByType('media_player')
            .filter((mp) => mp.attributes.last_called_timestamp)
            .sort((l, r) => Number(r.attributes.last_called_timestamp) - Number(l.attributes.last_called_timestamp))[0]) as HaItemMediaPlayer;
    }
}