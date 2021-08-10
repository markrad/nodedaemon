"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const haparentitem_js_1 = require("./haparentitem.js");
class HaItemMediaPlayer extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}
module.exports = HaItemMediaPlayer;
//# sourceMappingURL=haitemmedia_player.js.map