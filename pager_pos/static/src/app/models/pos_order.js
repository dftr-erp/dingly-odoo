/** @odoo-module */

import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(Order.prototype, {
  /** Odoo 17 orders are keyed by `uid`. Dingly calls that id `posOrderUuid`. */
  get uuid() {
    return this.uid;
  },
  export_for_printing() {
    const receipt = super.export_for_printing(...arguments);
    const tracking = this.trackingNumber;
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
