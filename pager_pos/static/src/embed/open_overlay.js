/** @odoo-module */

import { DinglyDialog } from "@pager_pos/embed/dingly_dialog";

/** Open the fullscreen Dingly overlay through the POS popup service. */
export function openDinglyOverlay(popup, base) {
  popup.add(DinglyDialog, { baseUrl: base || "" });
}
