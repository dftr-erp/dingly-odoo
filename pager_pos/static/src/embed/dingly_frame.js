/** @odoo-module */

import { Component, useState } from "@odoo/owl";

/** Embedded Dingly shop app URL for a register's API base, or "" when not configured. */
export function dinglyEmbedUrl(base) {
  const clean = String(base || "").trim().replace(/\/+$/, "");
  return clean ? `${clean}/embed/app` : "";
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Toolbar + iframe on Dingly's own embed page. Odoo passes no credential:
 * the login inside the frame is the gate.
 */
export class DinglyFrame extends Component {
  static template = "pager_pos.DinglyFrame";
  static props = {
    baseUrl: { type: String, optional: true },
    onClose: { type: Function, optional: true },
  };

  setup() {
    this.state = useState({ nonce: 0 });
  }

  get url() {
    return dinglyEmbedUrl(this.props.baseUrl);
  }

  get host() {
    return hostOf(this.url);
  }

  reload() {
    this.state.nonce++;
  }

  openTab() {
    window.open(this.url, "_blank", "noopener");
  }
}
