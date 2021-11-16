import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

class HaItemPerson extends HaParentItem {
    public constructor(item: State, logLevel: string) {
        super(item, logLevel);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemPerson;
