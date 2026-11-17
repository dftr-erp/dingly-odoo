/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";
import { ensurePager } from "@pager_pos/app/pager_service";

patch(PosStore.prototype, {
  async setup() {
    const result = await super.setup(...arguments);
    ensurePager(this);
    return result;
  },
});
