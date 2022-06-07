import { State } from '../hamain/state'
import { HaParentItem } from './haparentitem';

export class HaItemMediaPlayer extends HaParentItem {
    public constructor(item: State) {
        super(item);
    }
}

module.exports = HaItemMediaPlayer;