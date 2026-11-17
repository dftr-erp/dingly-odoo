# -*- coding: utf-8 -*-
# License LGPL-3. See <https://www.gnu.org/licenses/lgpl-3.0.html>.

import uuid

from odoo import _, api, fields, models
from odoo.exceptions import UserError

from .pager_http import PagerError, PagerHttp

_STATUSES = ("on_track", "done", "not_done")


class PagerDeskOrder(models.Model):
    _name = "pager.desk.order"
    _description = "Dingly order"
    _order = "id desc"
    _rec_name = "display_number"

    pos_config_id = fields.Many2one(
        "pos.config",
        string="Point of Sale",
        required=True,
        default=lambda self: self._default_pos_config(),
    )
    display_number = fields.Char(
        string="Order number",
        required=True,
        help="The number the guest sees. This is not a second ticket number.",
    )
    pos_order_uuid = fields.Char(
        string="Order id",
        required=True,
        copy=False,
        default=lambda self: str(uuid.uuid4()),
        readonly=True,
    )
    status = fields.Selection(
        selection=[
            ("on_track", "On track"),
            ("done", "Done"),
            ("not_done", "Not done"),
        ],
        string="Status",
        readonly=True,
        copy=False,
    )
    public_id = fields.Char(string="Public id", readonly=True, copy=False)
    counter_code = fields.Char(string="Counter", readonly=True, copy=False)
    status_message = fields.Char(string="Status line", readonly=True, copy=False)

    @api.model
    def _default_pos_config(self):
        connected = self.env["pos.config"].search(
            [("pager_credential", "!=", False)], limit=1
        )
        return connected or self.env["pos.config"].search([], limit=1)

    def copy(self, default=None):
        default = dict(default or {})
        default.setdefault("pos_order_uuid", str(uuid.uuid4()))
        default.setdefault("status", False)
        default.setdefault("public_id", False)
        default.setdefault("counter_code", False)
        default.setdefault("status_message", False)
        return super().copy(default)

    def _client(self):
        self.ensure_one()
        config = self.pos_config_id
        if (
            not config.pager_api_base
            or not config.pager_credential
            or not config.pager_counter_code
        ):
            raise UserError(
                _("Connect this register with Dingly Setup before placing an order.")
            )
        try:
            return PagerHttp(config.pager_api_base, config.pager_credential)
        except PagerError as error:
            raise UserError(str(error)) from None

    def _apply_order(self, payload):
        self.ensure_one()
        order = payload.get("order") if isinstance(payload, dict) else None
        if not isinstance(order, dict):
            return
        vals = {"status_message": False}
        status = order.get("status")
        if status in _STATUSES:
            vals["status"] = status
        public_id = order.get("publicId")
        if isinstance(public_id, str):
            vals["public_id"] = public_id
        display_number = self._as_text(order.get("displayNumber"))
        if display_number:
            vals["display_number"] = display_number
        counter_code = order.get("counterCode")
        if isinstance(counter_code, str):
            vals["counter_code"] = counter_code
        self.write(vals)

    def _remember_error(self, message):
        self.write({"status_message": (message or "")[:500]})

    def action_place(self):
        for order in self:
            number = (order.display_number or "").strip()
            if not number:
                raise UserError(_("Enter the order number."))
            try:
                client = order._client()
                payload = client.place_order(
                    order.pos_order_uuid,
                    number,
                    order.pos_config_id.pager_counter_code,
                    True,
                )
            except UserError as error:
                order._remember_error(str(error))
                continue
            except PagerError as error:
                order._remember_error(str(error))
                continue
            order._apply_order(payload)
        return True

    def action_set_on_track(self):
        return self._set_status("on_track")

    def action_set_done(self):
        return self._set_status("done")

    def action_set_not_done(self):
        return self._set_status("not_done")

    def _set_status(self, status):
        for order in self:
            try:
                payload = order._client().set_status(order.pos_order_uuid, status)
            except UserError as error:
                order._remember_error(str(error))
                continue
            except PagerError as error:
                order._remember_error(str(error))
                continue
            order._apply_order(payload)
        return True

    def action_refresh(self):
        grouped = {}
        for order in self:
            grouped.setdefault(order.pos_config_id, self.env["pager.desk.order"])
            grouped[order.pos_config_id] |= order
        for config, orders in grouped.items():
            try:
                client = orders[:1]._client()
                payload = client.fetch_orders(orders.mapped("pos_order_uuid"))
            except UserError as error:
                orders._remember_error(str(error))
                continue
            except PagerError as error:
                orders._remember_error(str(error))
                continue
            rows = payload.get("orders") if isinstance(payload, dict) else None
            by_uuid = {}
            if isinstance(rows, list):
                for row in rows:
                    if isinstance(row, dict) and row.get("posOrderUuid"):
                        by_uuid[row["posOrderUuid"]] = row
            for order in orders:
                row = by_uuid.get(order.pos_order_uuid)
                if row:
                    order._apply_order({"order": row})
                else:
                    order.write({"status_message": False})
        return True

    @staticmethod
    def _as_text(value):
        if isinstance(value, bool) or value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (int, float)):
            return str(value).strip()
        return ""
