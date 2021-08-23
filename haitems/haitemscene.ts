import { State } from '../hamain/index.js';
import { HaParentItem } from './haparentitem.js';

class HaItemScene extends HaParentItem {
    constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
    }

    activate() {
        this.callService(this.type, 'turn_on', { entity_id: this.entityId });
    }
}

module.exports = HaItemScene;