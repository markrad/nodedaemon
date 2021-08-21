"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaGenericUpdateableItem = void 0;
const haparentitem_js_1 = require("./haparentitem.js");
class HaGenericUpdateableItem extends haparentitem_js_1.HaParentItem {
    constructor(item) {
        super(item);
    }
    get isEditable() {
        return true;
    }
}
exports.HaGenericUpdateableItem = HaGenericUpdateableItem;
//# sourceMappingURL=hagenericupdatableitem.js.map