"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const haparentitem_1 = require("./haparentitem");
class HaItemZone extends haparentitem_1.HaParentItem {
    constructor(item) {
        super(item);
        this.on('new_state', (that, _oldstate) => {
            this.logger.debug(`Received new state: ${that.state}`);
        });
    }
    get longitude() {
        return this.attributes.longitude;
    }
    get latitude() {
        return this.attributes.latitude;
    }
    get radius() {
        return this.attributes.radius;
    }
}
module.exports = HaItemZone;
//# sourceMappingURL=haitemzone.js.map