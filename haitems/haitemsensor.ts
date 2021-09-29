import { State } from '../hamain/State'
import { HaParentItem } from './haparentitem';

class HaItemSensor extends HaParentItem {
    public constructor(item: State) {
        super(item);
        if (this.name.startsWith('rr_router')) {
            this.logger.level = 'info';
        }
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemSensor;