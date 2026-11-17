/** @odoo-module */

import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { dinglyEmbedUrl } from "@pager_pos/embed/dingly_frame";
import { openDinglyOverlay } from "@pager_pos/embed/open_overlay";

patch(Navbar.prototype, {
  get dinglyConfigured() {
    return Boolean(dinglyEmbedUrl(this.pos.config.pager_api_base));
  },
  openDingly() {
    openDinglyOverlay(this.popup, this.pos.config.pager_api_base);
  },
});
