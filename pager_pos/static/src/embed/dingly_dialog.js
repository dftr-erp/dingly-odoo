/** @odoo-module */

import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { DinglyFrame } from "@pager_pos/embed/dingly_frame";

/** Fullscreen overlay with the embedded Dingly app (POS). */
export class DinglyDialog extends Component {
  static template = "pager_pos.DinglyDialog";
  static components = { Dialog, DinglyFrame };
  static props = {
    baseUrl: { type: String, optional: true },
    close: Function,
  };
}
