# -*- coding: utf-8 -*-
# License LGPL-3. See <https://www.gnu.org/licenses/lgpl-3.0.html>.

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class PosConfig(models.Model):
    _inherit = "pos.config"

    pager_api_base = fields.Char(
        string="Dingly API Base URL",
        help="Origin of the pager service, for example https://dingly.win.",
    )
    pager_credential = fields.Char(
        string="Dingly Credential",
        copy=False,
        help="Bearer credential returned by Dingly Setup. It is not written to the log.",
    )
    pager_site_id = fields.Char(string="Dingly Site")
    pager_counter_code = fields.Char(
        string="Dingly Counter Code",
        help="Counter bound when a cashier assigns a pager.",
    )
    pager_counter_name = fields.Char(
        string="Dingly Counter Name",
        help="Shown on the Assign button, for example Front.",
    )
    pager_is_connected = fields.Boolean(
        string="Dingly Connected",
        compute="_compute_pager_is_connected",
    )
    pager_desk_order_ids = fields.One2many(
        "pager.desk.order",
        "pos_config_id",
        string="Dingly orders",
    )
    pager_status_summary = fields.Text(
        string="Dingly status",
        compute="_compute_pager_status_summary",
        help="Latest order numbers and the status codes returned by the pager service.",
    )

    @api.depends("pager_credential")
    def _compute_pager_is_connected(self):
        for config in self:
            config.pager_is_connected = bool(config.pager_credential)

    @api.depends(
        "pager_desk_order_ids.display_number",
        "pager_desk_order_ids.status",
    )
    def _compute_pager_status_summary(self):
        orders = self.env["pager.desk.order"].search(
            [("pos_config_id", "in", self.ids)],
            order="id desc",
        )
        lines = {config.id: [] for config in self}
        for order in orders:
            bucket = lines.get(order.pos_config_id.id)
            if bucket is None or len(bucket) >= 5:
                continue
            code = order.status or "not placed"
            bucket.append("%s %s" % (order.display_number, code))
        for config in self:
            bucket = lines.get(config.id) or []
            config.pager_status_summary = (
                "\n".join(bucket) if bucket else "No pager orders yet"
            )

    def _require_pager_connection(self):
        self.ensure_one()
        if (
            not self.pager_api_base
            or not self.pager_credential
            or not self.pager_counter_code
        ):
            raise UserError(
                _("Connect this register with Dingly Setup before placing an order.")
            )

    def action_pager_place_order(self):
        self.ensure_one()
        self._require_pager_connection()
        return {
            "type": "ir.actions.act_window",
            "name": _("Place pager order"),
            "res_model": "pager.desk.order",
            "view_mode": "form",
            "target": "new",
            "context": {"default_pos_config_id": self.id},
        }

    def action_pager_orders(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": _("Dingly orders"),
            "res_model": "pager.desk.order",
            "view_mode": "list,form",
            "domain": [("pos_config_id", "=", self.id)],
            "context": {"default_pos_config_id": self.id},
        }

    def action_pager_refresh_orders(self):
        orders = self.env["pager.desk.order"].search(
            [("pos_config_id", "in", self.ids)]
        )
        if orders:
            orders.action_refresh()
        return True

    @api.model
    def _load_pos_data_fields(self, config_id):
        field_names = list(super()._load_pos_data_fields(config_id))
        # An empty list means every field. Filling it would hide the rest of the register.
        if not field_names:
            return field_names
        for name in (
            "pager_api_base",
            "pager_credential",
            "pager_site_id",
            "pager_counter_code",
            "pager_counter_name",
        ):
            if name not in field_names:
                field_names.append(name)
        return field_names
