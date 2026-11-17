odoo.define("pager_pos.PagerWidget", function (require) {
  "use strict";

  const PosComponent = require("point_of_sale.PosComponent");
  const Registries = require("point_of_sale.Registries");
  const { _t } = require("web.core");
  const { displayNumberOf, ensurePager, orderKey } = require("@pager_pos/app/pager_service");
  const { onMounted, onWillUpdateProps, useState } = owl;

  class PagerWidget extends PosComponent {
    setup() {
      super.setup();
      this.pos = this.env.pos;
      this.pager = ensurePager(this.pos);
      this.shared = useState(this.pager.state);
      this.state = useState({ busy: false });
      onMounted(() => this.watchOrder(this.props.order));
      onWillUpdateProps((next) => this.watchOrder(next.order));
    }

    watchOrder(order) {
      const key = orderKey(order);
      if (key) {
        this.pager.watch(key);
      }
    }

    get order() {
      return this.props.order || null;
    }

    get configured() {
      return this.pager.client.configured;
    }

    get displayNumber() {
      const value = this.order && displayNumberOf(this.order);
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
      const uuid = orderKey(this.order);
      if (!uuid) {
        return { assigned: false, status: "", error: "" };
      }
      return (
        this.shared.byUuid[uuid] || {
          assigned: false,
          status: "",
          error: "",
        }
      );
    }

    get statusLine() {
      if (!orderKey(this.order)) {
        return _t("This order has no id yet.");
      }
      if (this.offline) {
        return _t("Can't reach Dingly. Retrying. The sale is safe in Odoo.");
      }
      if (this.capFull) {
        const limit = this.shared.fullLimit;
        return limit
          ? _t("All %s pagers are in use. Mark one done first.").replace("%s", limit)
          : _t("All pagers are in use. Mark one done first.");
      }
      if (this.record.error) {
        return this.record.error;
      }
      if (this.shared.globalError) {
        return this.shared.globalError;
      }
      const n = this.displayNumber;
      switch (this.record.status) {
        case "on_track":
          return n ? _t("On the rail. The guest can follow %s.").replace("%s", n) : _t("On the rail.");
        case "done":
          return _t("Ready sent.");
        case "not_done":
          return n ? _t('Closed. The guest sees "%s was closed".').replace("%s", n) : _t("Closed.");
      }
      return this.record.assigned ? _t("On the rail.") : _t("Not on the rail yet.");
    }

    get offline() {
      return Boolean(this.shared.offline);
    }

    get onRail() {
      return Boolean(this.record.assigned || this.record.status);
    }

    get capFull() {
      return Boolean(this.shared.full && !this.onRail);
    }

    get assignLabel() {
      const name = this.pager.client.counterName;
      return name ? _t("Assign to %s").replace("%s", name) : _t("Assign");
    }

    get statusIsError() {
      return !this.offline && Boolean(
        this.capFull || this.record.error || this.shared.globalError || !orderKey(this.order),
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
      if (!orderKey(this.order) || this.state.busy || !this.configured || this.capFull) {
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
      if (!orderKey(this.order) || this.state.busy || !this.configured) {
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

  PagerWidget.template = "pager_pos.PagerWidget";

  Registries.Component.add(PagerWidget);
  return PagerWidget;
});
