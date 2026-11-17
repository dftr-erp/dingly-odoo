/** @odoo-module */

import { DinglyDialog } from "@pager_pos/embed/dingly_dialog";

/** Open the fullscreen Dingly overlay through the dialog service. */
export function openDinglyOverlay(dialog, base) {
  dialog.add(DinglyDialog, { baseUrl: base || "" });
}
