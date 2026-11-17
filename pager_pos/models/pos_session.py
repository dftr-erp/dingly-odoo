# -*- coding: utf-8 -*-
# License LGPL-3. See <https://www.gnu.org/licenses/lgpl-3.0.html>.

from odoo import models


class PosSession(models.Model):
    _inherit = "pos.session"

    def _loader_params_pos_config(self):
        result = super()._loader_params_pos_config()
        fields = result["search_params"]["fields"]
        # An empty list means every field, which already includes the pager ones.
        if fields:
            for name in self.config_id._get_pager_pos_fields():
                if name not in fields:
                    fields.append(name)
        return result
