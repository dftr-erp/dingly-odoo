/** @odoo-module */

import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { patch } from "@web/core/utils/patch";
import { PagerWidget } from "@pager_pos/app/pager_widget/pager_widget";

patch(TicketScreen, {
  components: { ...TicketScreen.components, PagerWidget },
});
