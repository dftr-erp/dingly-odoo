/** @odoo-module */

import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";
import { DinglyFrame } from "@pager_pos/embed/dingly_frame";

/** Fullscreen overlay with the embedded Dingly app (POS). */
export class DinglyDialog extends AbstractAwaitablePopup {
  static template = "pager_pos.DinglyDialog";
  static components = { DinglyFrame };
  static defaultProps = { baseUrl: "" };
}
