/** @odoo-module */

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";
import { PagerWidget } from "@pager_pos/app/pager_widget/pager_widget";

patch(ReceiptScreen, {
  components: { ...ReceiptScreen.components, PagerWidget },
});
