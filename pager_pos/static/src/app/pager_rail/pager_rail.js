/** @odoo-module */

import { Component, onMounted, onWillUnmount, useRef, useState } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { _t } from "@web/core/l10n/translation";
import { dinglyEmbedUrl } from "@pager_pos/embed/dingly_frame";
import { openDinglyOverlay } from "@pager_pos/embed/open_overlay";
import { useService } from "@web/core/utils/hooks";
import { displayNumberOf, ensurePager } from "@pager_pos/app/pager_service";

const UNDO_SECONDS = 5; // same grace window as the Dingly web desk
const LATE_MINUTES = 8; // staff "late" mark used by Dingly alerts
const OVERDUE_MINUTES = 15;
const COLLAPSE_KEY = "dingly.rail.collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // private mode or blocked storage: the board still works, it just forgets
  }
}

/** "On the rail" board docked under the product grid: every on-track order of this site. */
export class PagerRail extends Component {
  static template = "pager_pos.PagerRail";
  static props = {};

  setup() {
    this.pos = usePos();
    this.pager = ensurePager(this.pos);
    this.dialog = useService("dialog");
    this.rail = useState(this.pager.rail);
    this.ui = useState({
      collapsed: readCollapsed(),
      composing: false,
      number: "",
      sending: false,
      sendError: "",
      now: Date.now(),
      pending: {},
      errors: {},
    });
    this.inputRef = useRef("railNumber");
    this._timers = {};
    onMounted(() => {
      if (!this.configured) {
        return;
      }
      this.pager.openRail();
      this._tick = setInterval(() => {
        this.ui.now = Date.now();
      }, 1000);
    });
    onWillUnmount(() => {
      clearInterval(this._tick);
      // Leaving the screen sends pending changes now instead of dropping them.
      for (const uuid of Object.keys(this._timers)) {
        this._commit(uuid);
      }
      this.pager.closeRail();
    });
  }

  get configured() {
    return this.pager.client.configured;
  }

  get dinglyConfigured() {
    return Boolean(dinglyEmbedUrl(this.pos.config.pager_api_base));
  }

  openDingly() {
    openDinglyOverlay(this.dialog, this.pos.config.pager_api_base);
  }

  get currentOrder() {
    return this.pos.get_order?.() || null;
  }

  get tickets() {
    const now = this.ui.now - (this.rail.skewMs || 0);
    const current = this.currentOrder?.uuid;
    return this.rail.orders.map((row) => {
      const created = Date.parse(row.createdAt);
      const minutes = Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 60000)) : 0;
      const pending = this.ui.pending[row.posOrderUuid];
      return {
        ...row,
        minutes,
        late: minutes >= LATE_MINUTES && minutes < OVERDUE_MINUTES,
        overdue: minutes >= OVERDUE_MINUTES,
        where: row.counterLabel || (row.pos === "desk" ? _t("Desk") : _t("Counter")),
        source: row.pos === "odoo" ? "Odoo" : row.pos === "desk" ? _t("Desk") : row.pos,
        isCurrent: Boolean(current && row.posOrderUuid === current),
        pending,
        countdown: pending ? Math.max(0, Math.ceil((pending.until - this.ui.now) / 1000)) : 0,
        error: this.ui.errors[row.posOrderUuid] || "",
      };
    });
  }

  get count() {
    return this.rail.orders.length;
  }

  get oldestMinutes() {
    const first = this.tickets[0];
    return first ? first.minutes : 0;
  }

  get summary() {
    if (this.rail.offline) {
      return _t("Can't reach Dingly. Retrying. Sales are safe in Odoo.");
    }
    if (this.rail.error) {
      return this.rail.error;
    }
    if (!this.rail.loaded) {
      return _t("Loading the rail…");
    }
    if (!this.count) {
      return _t("Rail is clear. Updates every 5 s.");
    }
    const waiting = this.count === 1 ? _t("1 waiting.") : _t("%s waiting.", this.count);
    const m = this.oldestMinutes;
    const oldest =
      m < 1
        ? _t("Oldest came in just now.")
        : m === 1
          ? _t("Oldest has waited 1 minute.")
          : _t("Oldest has waited %s minutes.", m);
    return `${waiting} ${oldest} ${_t("Updates every 5 s.")}`;
  }

  get capDots() {
    const limit = this.rail.limit;
    if (!limit || limit > 12) {
      return [];
    }
    return Array.from({ length: limit }, (_, i) => i < this.count);
  }

  get capFull() {
    return Boolean(this.rail.limit && this.count >= this.rail.limit);
  }

  get suggestedNumber() {
    const order = this.currentOrder;
    const value = displayNumberOf(order);
    if (value === null || value === undefined || value === "") {
      return "";
    }
    const onRail = this.rail.orders.some((row) => row.posOrderUuid === order.uuid);
    return onRail ? "" : String(value);
  }

  toggleCollapsed() {
    this.ui.collapsed = !this.ui.collapsed;
    writeCollapsed(this.ui.collapsed);
    if (!this.ui.collapsed) {
      this.pager.refreshRail();
    }
  }

  openCompose() {
    this.ui.collapsed = false;
    writeCollapsed(false);
    this.ui.composing = true;
    this.ui.sendError = "";
    this.ui.number = this.suggestedNumber;
    setTimeout(() => {
      const el = this.inputRef.el;
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);
  }

  closeCompose() {
    this.ui.composing = false;
    this.ui.sendError = "";
  }

  onComposeKey(ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      this.send();
    } else if (ev.key === "Escape") {
      this.closeCompose();
    }
  }

  async send() {
    if (this.ui.sending) {
      return;
    }
    this.ui.sending = true;
    this.ui.sendError = "";
    try {
      await this.pager.sendToRail(this.ui.number, this.currentOrder);
      this.ui.composing = false;
      this.ui.number = "";
      await this.pager.refreshRail();
    } catch (error) {
      this.ui.sendError = error.offline
        ? _t("Can't reach Dingly. Try again in a moment.")
        : error.message || _t("Dingly request failed.");
    } finally {
      this.ui.sending = false;
    }
  }

  /** Done / Not done wait UNDO_SECONDS so a mis-tap never pings a guest. */
  mark(ticket, status) {
    const uuid = ticket.posOrderUuid;
    if (this.ui.pending[uuid]) {
      return;
    }
    delete this.ui.errors[uuid];
    this.ui.pending[uuid] = { status, until: Date.now() + UNDO_SECONDS * 1000 };
    this._timers[uuid] = setTimeout(() => this._commit(uuid), UNDO_SECONDS * 1000);
  }

  undo(ticket) {
    const uuid = ticket.posOrderUuid;
    clearTimeout(this._timers[uuid]);
    delete this._timers[uuid];
    delete this.ui.pending[uuid];
  }

  async _commit(uuid) {
    const pending = this.ui.pending[uuid];
    clearTimeout(this._timers[uuid]);
    delete this._timers[uuid];
    if (!pending) {
      return;
    }
    try {
      await this.pager.railSetStatus(uuid, pending.status);
      this.rail.orders = this.rail.orders.filter((row) => row.posOrderUuid !== uuid);
    } catch (error) {
      this.ui.errors[uuid] = error.offline
        ? _t("Can't reach Dingly. Try again.")
        : error.message || _t("Dingly request failed.");
    } finally {
      delete this.ui.pending[uuid];
    }
  }

  openGuest(ticket) {
    if (ticket.guestUrl) {
      window.open(ticket.guestUrl, "_blank", "noopener");
    }
  }
}
