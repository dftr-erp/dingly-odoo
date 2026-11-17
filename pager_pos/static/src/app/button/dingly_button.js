odoo.define("pager_pos.DinglyButton", function (require) {
  "use strict";

  const PosComponent = require("point_of_sale.PosComponent");
  const Registries = require("point_of_sale.Registries");
  const { dinglyEmbedUrl } = require("@pager_pos/embed/dingly_frame");

  /** Header "Dingly" button: opens the shop app in a fullscreen overlay. */
  class DinglyButton extends PosComponent {
    get configured() {
      return Boolean(dinglyEmbedUrl(this.env.pos.config.pager_api_base));
    }
    onClick() {
      this.showPopup("DinglyPopup", { baseUrl: this.env.pos.config.pager_api_base || "" });
    }
  }
  DinglyButton.template = "pager_pos.DinglyButton";

  Registries.Component.add(DinglyButton);
  return DinglyButton;
});
