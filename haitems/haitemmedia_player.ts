import { State } from '../hamain/index.js';
import { HaParentItem } from './haparentitem.js';

class HaItemMediaPlayer extends HaParentItem {
    constructor(item: State) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}

module.exports = HaItemMediaPlayer;