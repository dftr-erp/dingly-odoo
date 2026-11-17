/** @odoo-module */

import { reactive } from "@odoo/owl";
import { PagerClient, ordersFromPayload } from "@pager_pos/app/pager_client";

const POLL_MS = 8000;
export const RAIL_POLL_MS = 5000;

export function displayNumberOf(order) {
  if (!order) {
    return null;
  }
  const value = order.tracking_number ?? order.trackingNumber;
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return null;
}

function rowUuid(row, requested) {
  if (!row || typeof row !== "object") {
    return null;
  }
  if (typeof row.posOrderUuid === "string" && requested.has(row.posOrderUuid)) {
    return row.posOrderUuid;
  }
  if (typeof row.uuid === "string" && requested.has(row.uuid)) {
    return row.uuid;
  }
  if (typeof row.id === "string" && requested.has(row.id)) {
    return row.id;
  }
  return null;
}

export class PagerSession {
  constructor(pos) {
    this.pos = pos;
    this.client = new PagerClient(pos);
    this.state = reactive({
      byUuid: {},
      globalError: "",
      offline: false,
      full: false,
    });
    this.rail = reactive({
      orders: [],
      limit: null,
      skewMs: 0,
      loaded: false,
      offline: false,
      error: "",
      viewers: 0,
    });
    this._railTimer = null;
    this._railLoading = false;
    this._version = 0;
    this._refreshing = false;
    this._refreshTimer = null;
    this._pollTimer = null;
    if (typeof window !== "undefined") {
      this._pollTimer = window.setInterval(() => this.refreshNow(), POLL_MS);
      window.addEventListener("beforeunload", () => this.stop(), {
        once: true,
      });
    }
  }

  stop() {
    this._stopRailTimer();
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  _ensure(uuid) {
    if (!this.state.byUuid[uuid]) {
      this.state.full = false; // a new order is a fresh state: let the cashier retry
      this.state.byUuid[uuid] = {
        assigned: false,
        status: "",
        error: "",
        watched: true,
        known: false,
      };
    }
    this.state.byUuid[uuid].watched = true;
    return this.state.byUuid[uuid];
  }

  watch(uuid) {
    if (!uuid || !this.client.configured || this.state.byUuid[uuid]?.watched) {
      return;
    }
    this._ensure(uuid);
    this.refreshSoon();
  }

  refreshSoon() {
    if (this._refreshTimer) {
      return;
    }
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      this.refreshNow();
    }, 200);
  }

  async assign(order, assigned) {
    const uuid = order && order.uuid;
    if (!uuid) {
      return;
    }
    const version = ++this._version;
    const current = this._ensure(uuid);
    try {
      const payload = await this.client.createOrder({
        posOrderUuid: uuid,
        displayNumber: displayNumberOf(order),
        assigned: Boolean(assigned),
      });
      if (version !== this._version) {
        return;
      }
      this._version += 1;
      this.refreshRailSoon();
      this._applyPayload(uuid, payload, {
        assigned: Boolean(assigned),
        status: assigned ? "on_track" : current.status,
      });
      this.state.globalError = "";
      this.state.offline = false;
    } catch (error) {
      if (version !== this._version) {
        return;
      }
      this._version += 1;
      this.state.offline = Boolean(error.offline);
      if (error.code === "pager_cap") {
        this.state.full = true;
        this.state.fullLimit = Number(error.limit) || 0;
      } else {
        current.error = error.offline ? "" : error.message || "Dingly request failed.";
      }
    }
  }

  async setStatus(order, status) {
    const uuid = order && order.uuid;
    if (!uuid) {
      return;
    }
    const version = ++this._version;
    const current = this._ensure(uuid);
    try {
      const payload = await this.client.updateStatus(uuid, status);
      if (version !== this._version) {
        return;
      }
      this._version += 1;
      let assigned = current.assigned;
      if (status === "on_track") {
        assigned = true;
      } else if (status === "done" || status === "not_done") {
        assigned = false;
      }
      this._applyPayload(uuid, payload, { status, assigned });
      this.refreshRailSoon();
      if (status !== "on_track") {
        this.state.full = false;
      }
      this.state.globalError = "";
      this.state.offline = false;
    } catch (error) {
      if (version !== this._version) {
        return;
      }
      this._version += 1;
      this.state.offline = Boolean(error.offline);
      current.error = error.offline ? "" : error.message || "Dingly request failed.";
    }
  }

  async refreshNow() {
    if (!this.client.configured || this._refreshing) {
      return;
    }
    const ids = Object.keys(this.state.byUuid).filter(
      (uuid) => this.state.byUuid[uuid].watched,
    );
    if (!ids.length) {
      return;
    }
    const version = this._version;
    this._refreshing = true;
    try {
      const payload = await this.client.fetchOrders(ids);
      if (version !== this._version) {
        return;
      }
      this._applyList(payload, ids);
      this.state.globalError = "";
      this.state.offline = false;
    } catch (error) {
      if (version === this._version) {
        this.state.offline = Boolean(error.offline);
        this.state.globalError = error.offline ? "" : error.message || "Dingly request failed.";
      }
    } finally {
      this._refreshing = false;
    }
  }

  // ---- Rail board (every on-track order of the site, from Odoo or the Dingly desk) ----

  /** A mounted board calls this; polling runs only while at least one board is visible. */
  openRail() {
    this.rail.viewers += 1;
    if (!this._railTimer && typeof window !== "undefined") {
      this._railTimer = window.setInterval(() => this.refreshRail(), RAIL_POLL_MS);
    }
    this.refreshRail();
  }

  closeRail() {
    this.rail.viewers = Math.max(0, this.rail.viewers - 1);
    if (!this.rail.viewers) {
      this._stopRailTimer();
    }
  }

  _stopRailTimer() {
    if (this._railTimer) {
      clearInterval(this._railTimer);
      this._railTimer = null;
    }
  }

  refreshRailSoon() {
    if (this.rail.viewers) {
      setTimeout(() => this.refreshRail(), 150);
    }
  }

  async refreshRail() {
    if (!this.client.configured || this._railLoading) {
      return;
    }
    this._railLoading = true;
    try {
      const payload = await this.client.fetchRail();
      const list = Array.isArray(payload?.orders) ? payload.orders : [];
      const serverNow = Date.parse(payload?.now);
      this.rail.skewMs = Number.isFinite(serverNow) ? Date.now() - serverNow : 0;
      this.rail.orders = list.filter((row) => row && row.posOrderUuid);
      this.rail.limit = Number(payload?.limit) > 0 ? Number(payload.limit) : null;
      this.rail.loaded = true;
      this.rail.offline = false;
      this.rail.error = "";
      if (this.rail.limit && this.rail.orders.length < this.rail.limit) {
        this.state.full = false;
      }
    } catch (error) {
      this.rail.offline = Boolean(error.offline);
      this.rail.error = error.offline ? "" : error.message || "Dingly request failed.";
    } finally {
      this._railLoading = false;
    }
  }

  /** Done / Not done from the board. Keeps the receipt widget in sync when Odoo knows the order. */
  async railSetStatus(posOrderUuid, status) {
    const known = this.state.byUuid[posOrderUuid];
    if (known) {
      await this.setStatus({ uuid: posOrderUuid }, status);
      if (known.error) {
        throw new Error(known.error);
      }
      return;
    }
    await this.client.updateStatus(posOrderUuid, status);
    this.refreshRailSoon();
  }

  /** Put a number on the rail. Uses the open Odoo order when the number is its tracking number. */
  async sendToRail(displayNumber, order) {
    const number = String(displayNumber || "").trim();
    if (!number) {
      throw new Error("Type the order number.");
    }
    if (order?.uuid && String(displayNumberOf(order) ?? "") === number) {
      await this.assign(order, true);
      const current = this.state.byUuid[order.uuid];
      if (this.state.full) {
        throw Object.assign(new Error("All pagers are in use. Mark one done first."), { code: "pager_cap" });
      }
      if (current?.error) {
        throw new Error(current.error);
      }
      return;
    }
    const uuid = `odoo-rail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await this.client.createOrder({ posOrderUuid: uuid, displayNumber: number, assigned: true });
    this.refreshRailSoon();
  }

  _applyPayload(uuid, payload, fallback) {
    const row = this._rowFromPayload(payload);
    const current = this._ensure(uuid);
    if (row && typeof row.status === "string" && row.status) {
      current.status = row.status;
    } else if (fallback.status) {
      current.status = fallback.status;
    }
    if (row && typeof row.assigned === "boolean") {
      current.assigned = row.assigned;
    } else if (typeof fallback.assigned === "boolean") {
      current.assigned = fallback.assigned;
    }
    current.error = "";
    current.known = true;
  }

  _rowFromPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    if (payload.order && typeof payload.order === "object") {
      return payload.order;
    }
    if (
      typeof payload.status === "string" ||
      typeof payload.assigned === "boolean"
    ) {
      return payload;
    }
    return null;
  }

  _applyList(payload, ids) {
    const requested = new Set(ids);
    for (const row of ordersFromPayload(payload)) {
      const uuid = rowUuid(row, requested);
      if (!uuid || !this.state.byUuid[uuid]) {
        continue;
      }
      const current = this.state.byUuid[uuid];
      if (typeof row.status === "string") {
        if (current.status === "on_track" && row.status !== "on_track") {
          this.state.full = false;
        }
        current.status = row.status;
      }
      if (typeof row.assigned === "boolean") {
        current.assigned = row.assigned;
      } else if (row.status === "on_track") {
        current.assigned = true;
      } else if (row.status === "done" || row.status === "not_done") {
        current.assigned = false;
      }
      current.known = true;
    }
  }
}

export function ensurePager(pos) {
  if (!pos.pager) {
    pos.pager = new PagerSession(pos);
  }
  return pos.pager;
}
