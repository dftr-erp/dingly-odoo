/** @odoo-module */

import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { patch } from "@web/core/utils/patch";
import { PagerRail } from "@pager_pos/app/pager_rail/pager_rail";

patch(ProductScreen, {
  components: { ...ProductScreen.components, PagerRail },
});
