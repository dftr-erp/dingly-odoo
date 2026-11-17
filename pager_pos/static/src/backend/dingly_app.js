/** @odoo-module */

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { DinglyFrame } from "@pager_pos/embed/dingly_frame";

/** "Dingly" backend app: the shop app in an iframe, or a setup prompt. */
export class DinglyApp extends Component {
  static template = "pager_pos.DinglyApp";
  static components = { DinglyFrame };
  static props = ["*"];

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");
    this.state = useState({ loaded: false, base: "" });
    onWillStart(async () => {
      const rows = await this.orm.searchRead(
        "pos.config",
        [["pager_api_base", "!=", false]],
        ["pager_api_base"],
        { limit: 1, order: "id" }
      );
      this.state.base = (rows[0]?.pager_api_base || "").trim().replace(/\/+$/, "");
      this.state.loaded = true;
    });
  }

  openSetup() {
    this.action.doAction("pager_pos.action_pager_setup_wizard");
  }
}

registry.category("actions").add("pager_pos.dingly_app", DinglyApp);
