# -*- coding: utf-8 -*-
# License LGPL-3. See <https://www.gnu.org/licenses/lgpl-3.0.html>.

from odoo import _, api, fields, models
from odoo.exceptions import UserError

from odoo.addons.pager_pos.models.pager_http import (
    PagerError,
    PagerHttp,
    clean_api_base,
)


class PagerSetupWizard(models.TransientModel):
    _name = "pager.setup.wizard"
    _description = "Dingly Setup"

    api_base = fields.Char(
        string="API Base URL",
        required=True,
        default="https://dingly.win",
        help="Origin of the pager service. Do not include /v1.",
    )
    token = fields.Char(
        string="Setup Token",
        required=True,
        help="Paste the setup token from the Dingly dashboard. The token is single-use.",
    )
    pos_config_id = fields.Many2one(
        "pos.config",
        string="Point of Sale",
        required=True,
        default=lambda self: self.env["pos.config"].search([], limit=1),
    )

    @api.onchange("pos_config_id")
    def _onchange_pos_config_id(self):
        if self.pos_config_id.pager_api_base:
            self.api_base = self.pos_config_id.pager_api_base

    def action_confirm(self):
        self.ensure_one()
        token = (self.token or "").strip()
        if not token:
            raise UserError(_("Enter the setup token from the Dingly dashboard."))
        try:
            api_base = clean_api_base(self.api_base)
            payload = PagerHttp(api_base).call(
                "POST", "/v1/plugin/redeem", {"token": token}
            )
        except PagerError as error:
            raise UserError(str(error)) from None
        credential = payload.get("credential")
        if not isinstance(credential, str) or not credential.strip():
            raise UserError(_("Dingly setup did not return a credential."))
        returned_base = payload.get("apiBase")
        if isinstance(returned_base, str) and returned_base.strip():
            try:
                stored_base = clean_api_base(returned_base)
            except PagerError as error:
                raise UserError(str(error)) from None
        else:
            stored_base = api_base
        self.pos_config_id.write(
            {
                "pager_api_base": stored_base,
                "pager_credential": credential.strip(),
                "pager_site_id": self._as_text(payload.get("siteId")),
                "pager_counter_code": self._as_text(payload.get("counterCode")),
                "pager_counter_name": self._as_text(payload.get("counterName")),
            }
        )
        return {"type": "ir.actions.act_window_close"}

    @api.model
    def _as_text(self, value):
        if isinstance(value, bool) or value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, int):
            return str(value)
        return ""
