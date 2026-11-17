/** @odoo-module */

import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { patch } from "@web/core/utils/patch";

patch(PosOrder.prototype, {
  export_for_printing(baseUrl, headerData) {
    const receipt = super.export_for_printing(...arguments);
    const tracking = this.tracking_number;
    receipt.tracking_number = tracking;
    receipt.trackingNumber = tracking;
    if (receipt.headerData) {
      receipt.headerData = {
        ...receipt.headerData,
        trackingNumber: tracking,
      };
    }
    return receipt;
  },
});
