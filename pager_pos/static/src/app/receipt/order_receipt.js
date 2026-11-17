/** @odoo-module */

import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import { patch } from "@web/core/utils/patch";

patch(OrderReceipt.prototype, {
  get pagerTrackingNumber() {
    const order = this.props.order || {};
    const config = order.config || {};
    // Odoo shows a big number itself when this is on; don't repeat it.
    if (config.displayBigTrackingNumber && order.tracking_number) {
      return "";
    }
    const value = order.tracking_number;
    if (
      value === undefined ||
      value === null ||
      value === false ||
      value === ""
    ) {
      return "";
    }
    return String(value);
  },
});
