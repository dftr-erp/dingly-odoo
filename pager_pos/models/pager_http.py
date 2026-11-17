# -*- coding: utf-8 -*-
# License LGPL-3. See <https://www.gnu.org/licenses/lgpl-3.0.html>.

import json
import urllib.error
import urllib.parse
import urllib.request


class PagerError(Exception):
    """A pager response the caller can show. It never includes the credential."""


def clean_api_base(value):
    api_base = (value or "").strip().rstrip("/")
    if not api_base.startswith(("http://", "https://")) or any(
        char.isspace() for char in api_base
    ):
        raise PagerError("The API base URL must start with http:// or https://.")
    return api_base


class PagerHttp:
    """HTTP client for the pager API. Callers must not log the credential."""

    def __init__(self, api_base, credential=None, timeout=20):
        self.api_base = clean_api_base(api_base)
        self.credential = (credential or "").strip()
        self.timeout = timeout

    def call(self, method, path, body=None):
        headers = {"Accept": "application/json"}
        if self.credential:
            headers["Authorization"] = "Bearer %s" % self.credential
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            self.api_base + path,
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            raise PagerError(self._http_error_message(error)) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            # A hung or dropped connection raises TimeoutError/OSError, not URLError.
            raise PagerError(
                "Could not reach the pager service at %s." % self.api_base
            ) from None
        if not raw:
            return {}
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            raise PagerError("Dingly returned an unreadable response.") from None
        if not isinstance(payload, dict):
            raise PagerError("Dingly returned an unreadable response.")
        return payload

    def place_order(self, pos_order_uuid, display_number, counter_code, assigned):
        return self.call(
            "POST",
            "/v1/orders",
            {
                "pos": "odoo",
                "posOrderUuid": pos_order_uuid,
                "displayNumber": display_number,
                "counterCode": counter_code,
                "assigned": bool(assigned),
            },
        )

    def set_status(self, pos_order_uuid, status):
        quoted = urllib.parse.quote(pos_order_uuid, safe="")
        return self.call("PATCH", "/v1/orders/%s" % quoted, {"status": status})

    def fetch_orders(self, pos_order_uuids):
        ids = ",".join(
            urllib.parse.quote(uuid, safe="") for uuid in pos_order_uuids if uuid
        )
        return self.call("GET", "/v1/orders?ids=%s" % ids)

    @staticmethod
    def _http_error_message(error):
        raw = ""
        try:
            raw = error.read().decode("utf-8")
        except Exception:
            raw = ""
        message = ""
        if raw:
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = None
            if isinstance(payload, dict):
                candidate = payload.get("message") or payload.get("error") or ""
                if isinstance(candidate, str):
                    message = candidate.strip()
        if not message:
            message = "Dingly request failed (%s)." % getattr(error, "code", "")
        return message[:500]
