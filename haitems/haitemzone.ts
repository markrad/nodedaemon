import { State } from '../hamain/State'
import { HaParentItem } from './haparentitem';

class HaItemZone extends HaParentItem {
    public constructor(item: State) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }

    public get longitude(): number {
        return this.attributes.longitude;
    }

    public get latitude(): number {
        return this.attributes.latitude;
    }

    public get radius(): number {
        return this.attributes.radius;
    }
}

module.exports = HaItemZone;