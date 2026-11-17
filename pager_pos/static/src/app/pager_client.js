/** @odoo-module */
// Sole browser caller for the pager HTTP API.

export function pagerUrl(apiBase, path) {
  const base = String(apiBase || "").replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function ordersFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  if (Array.isArray(payload.orders)) {
    return payload.orders;
  }
  if (payload.orders && typeof payload.orders === "object") {
    return Object.entries(payload.orders).map(([key, value]) => ({
      ...(value && typeof value === "object" ? value : {}),
      posOrderUuid: (value && value.posOrderUuid) || key,
    }));
  }
  return [];
}

function messageFrom(payload, status) {
  if (
    payload &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message.trim();
  }
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return `Dingly request failed (${status}).`;
}

export class PagerClient {
  constructor(pos) {
    this.pos = pos;
  }

  get config() {
    return this.pos.config || {};
  }

  get apiBase() {
    return String(this.config.pager_api_base || "").replace(/\/+$/, "");
  }

  get credential() {
    const value = this.config.pager_credential;
    return typeof value === "string" ? value.trim() : "";
  }

  get counterCode() {
    const value = this.config.pager_counter_code;
    if (value === undefined || value === null || value === false) {
      return "";
    }
    return String(value).trim();
  }

  get counterName() {
    const value = this.config.pager_counter_name;
    return typeof value === "string" ? value.trim() : "";
  }

  get configured() {
    return Boolean(this.apiBase && this.credential && this.counterCode);
  }

  createOrder({ posOrderUuid, displayNumber, assigned }) {
    return this._request("POST", "/v1/orders", {
      pos: "odoo",
      posOrderUuid,
      displayNumber,
      counterCode: this.counterCode,
      assigned: Boolean(assigned),
    });
  }

  updateStatus(posOrderUuid, status) {
    return this._request(
      "PATCH",
      `/v1/orders/${encodeURIComponent(posOrderUuid)}`,
      {
        status,
      },
    );
  }

  fetchRail() {
    return this._request("GET", "/v1/orders/rail");
  }

  fetchOrders(ids) {
    const query = ids.map((id) => encodeURIComponent(id)).join(",");
    return this._request("GET", `/v1/orders?ids=${query}`);
  }

  async _request(method, path, body) {
    if (!this.configured) {
      throw new Error("Dingly is not configured for this register.");
    }
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${this.credential}`,
    };
    const options = {
      method,
      headers,
      credentials: "omit",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      // ponytail: fixed 10s ceiling so a hung host reads as connection lost
      options.signal = AbortSignal.timeout(10000);
      response = await fetch(pagerUrl(this.apiBase, path), options);
    } catch {
      throw Object.assign(new Error("Can't reach Dingly. Retrying. The sale is safe in Odoo."), { offline: true });
    }
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (!response.ok) {
      throw Object.assign(new Error(messageFrom(payload, response.status)), {
        code: payload && payload.error,
        limit: payload && payload.limit,
      });
    }
    return payload;
  }
}
