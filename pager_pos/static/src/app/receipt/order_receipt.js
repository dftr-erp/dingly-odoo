/** @odoo-module */

import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import { patch } from "@web/core/utils/patch";

patch(OrderReceipt.prototype, {
  get pagerTrackingNumber() {
    const data = this.props.data || {};
    const header = data.headerData || {};
    if (header.bigTrackingNumber && header.trackingNumber) {
      return "";
    }
    const value =
      data.trackingNumber ?? data.tracking_number ?? header.trackingNumber;
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
