odoo.define("pager_pos.models", function (require) {
  "use strict";

  const { Order } = require("point_of_sale.models");
  const Registries = require("point_of_sale.Registries");

  const PagerOrder = (Order) =>
    class PagerOrder extends Order {
      /** Number the guest types at the counter. Odoo 16 has no tracking number. */
      get pagerNumber() {
        const value = this.sequence_number;
        return value === undefined || value === null ? "" : String(value);
      }
      //@override
      export_for_printing() {
        const receipt = super.export_for_printing(...arguments);
        receipt.pager_number = this.pagerNumber;
        return receipt;
      }
    };

  Registries.Model.extend(Order, PagerOrder);

  return PagerOrder;
});
