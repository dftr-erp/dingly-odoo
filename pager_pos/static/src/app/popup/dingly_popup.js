odoo.define("pager_pos.DinglyPopup", function (require) {
  "use strict";

  const AbstractAwaitablePopup = require("point_of_sale.AbstractAwaitablePopup");
  const Registries = require("point_of_sale.Registries");
  const { dinglyEmbedUrl } = require("@pager_pos/embed/dingly_frame");
  const { useState } = owl;

  /** Fullscreen overlay with the embedded Dingly app. */
  class DinglyPopup extends AbstractAwaitablePopup {
    setup() {
      super.setup();
      this.state = useState({ nonce: 0 });
    }
    get url() {
      return dinglyEmbedUrl(this.props.baseUrl);
    }
    get host() {
      try {
        return new URL(this.url).host;
      } catch {
        return this.url;
      }
    }
    reload() {
      this.state.nonce++;
    }
    openTab() {
      window.open(this.url, "_blank", "noopener");
    }
  }
  DinglyPopup.template = "pager_pos.DinglyPopup";

  Registries.Component.add(DinglyPopup);
  return DinglyPopup;
});
