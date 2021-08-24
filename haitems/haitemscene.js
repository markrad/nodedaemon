"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const haparentitem_js_1 = require("./haparentitem.js");
class HaItemScene extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
    }
    activate() {
        this._callService(this.type, 'turn_on', { entity_id: this.entityId });
    }
}
module.exports = HaItemScene;
//# sourceMappingURL=haitemscene.js.map