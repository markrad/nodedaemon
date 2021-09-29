"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const haparentitem_1 = require("./haparentitem");
class HaItemDeviceTracker extends haparentitem_1.HaParentItem {
    constructor(item) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}
module.exports = HaItemDeviceTracker;
//# sourceMappingURL=haitemdevice_tracker.js.map