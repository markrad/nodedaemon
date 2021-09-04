"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const haparentitem_js_1 = require("./haparentitem.js");
class HaItemSensor extends haparentitem_js_1.HaParentItem {
    constructor(item) {
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
//# sourceMappingURL=haitemsensor.js.map