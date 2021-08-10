"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const haparentitem_js_1 = require("./haparentitem.js");
class HaItemBinarySensor extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
        this.logger.level = 'debug';
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
}
module.exports = HaItemBinarySensor;
//# sourceMappingURL=haitembinary_sensor.js.map