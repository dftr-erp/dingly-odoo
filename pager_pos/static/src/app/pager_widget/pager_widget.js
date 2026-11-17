/** @odoo-module */

import { Component, onMounted, onWillUpdateProps, useState } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { _t } from "@web/core/l10n/translation";
import { ensurePager } from "@pager_pos/app/pager_service";

export class PagerWidget extends Component {
  static template = "pager_pos.PagerWidget";
  static props = {
    order: { type: Object, optional: true },
  };

  setup() {
    this.pos = usePos();
    this.pager = ensurePager(this.pos);
    this.state = useState({ busy: false });
    onMounted(() => this.watchOrder(this.props.order));
    onWillUpdateProps((next) => this.watchOrder(next.order));
  }

  watchOrder(order) {
    if (order?.uuid) {
      this.pager.watch(order.uuid);
    }
  }

  get order() {
    return this.props.order || null;
  }

  get configured() {
    return this.pager.client.configured;
  }

  get displayNumber() {
    const value = this.order?.tracking_number ?? this.order?.trackingNumber;
    if (
      value === undefined ||
      value === null ||
      value === false ||
      value === ""
    ) {
      return "";
    }
    return String(value);
  }

  get record() {
    const uuid = this.order?.uuid;
    if (!uuid) {
      return { assigned: false, status: "", error: "" };
    }
    return (
      this.pager.state.byUuid[uuid] || {
        assigned: false,
        status: "",
        error: "",
      }
    );
  }

  get statusLine() {
    if (!this.order?.uuid) {
      return _t("This order has no uuid yet.");
    }
    if (this.offline) {
      return _t("Can't reach Dingly. Retrying. The sale is safe in Odoo.");
    }
    if (this.capFull) {
      const limit = this.pager.state.fullLimit;
      return limit
        ? _t("All %s pagers are in use. Mark one done first.", limit)
        : _t("All pagers are in use. Mark one done first.");
    }
    if (this.record.error) {
      return this.record.error;
    }
    if (this.pager.state.globalError) {
      return this.pager.state.globalError;
    }
    const n = this.displayNumber;
    switch (this.record.status) {
      case "on_track":
        return n ? _t("On the rail. The guest can follow %s.", n) : _t("On the rail.");
      case "done":
        return _t("Ready sent.");
      case "not_done":
        return n ? _t('Closed. The guest sees "%s was closed".', n) : _t("Closed.");
    }
    return this.record.assigned ? _t("On the rail.") : _t("Not on the rail yet.");
  }

  get offline() {
    return Boolean(this.pager.state.offline);
  }

  get onRail() {
    return Boolean(this.record.assigned || this.record.status);
  }

  get capFull() {
    return Boolean(this.pager.state.full && !this.onRail);
  }

  get assignLabel() {
    const name = this.pager.client.counterName;
    return name ? _t("Assign to %s", name) : _t("Assign");
  }

  get statusIsError() {
    return !this.offline && Boolean(
      this.capFull || this.record.error || this.pager.state.globalError || !this.order?.uuid,
    );
  }

  statusClass(status) {
    const active = this.record.status === status;
    if (status === "done") {
      return active ? "btn btn-success" : "btn btn-outline-success";
    }
    if (status === "not_done") {
      return active ? "btn btn-secondary" : "btn btn-outline-secondary";
    }
    return active ? "btn btn-primary" : "btn btn-outline-primary";
  }

  async toggleAssign() {
    if (!this.order?.uuid || this.state.busy || !this.configured || this.capFull) {
      return;
    }
    this.state.busy = true;
    try {
      await this.pager.assign(this.order, true);
    } finally {
      this.state.busy = false;
    }
  }

  setOnTrack() {
    return this.setStatus("on_track");
  }

  setDone() {
    return this.setStatus("done");
  }

  setNotDone() {
    return this.setStatus("not_done");
  }

  async setStatus(status) {
    if (!this.order?.uuid || this.state.busy || !this.configured) {
      return;
    }
    this.state.busy = true;
    try {
      await this.pager.setStatus(this.order, status);
    } finally {
      this.state.busy = false;
    }
  }
}
